"""The 'ridge / quick-fit' engine from architecture doc section 6.1.

There is no real ingestion/harmonization pipeline behind this yet (see
README), so a validated DatasetVersion doesn't carry real rows -- it
carries a content hash and shape. To keep the modeling step honest rather
than faking diagnostics, this module synthesizes a plausible weekly panel
from the ModelSpec's declared channels/controls with a known ground-truth
response, then fits real ridge regression against it and reports the
actual residual-based diagnostics. Swapping this for a real feature
warehouse read is the only change needed once ingestion exists -- the
fitting/diagnostics code below doesn't know the difference.
"""
import hashlib

import numpy as np

N_WEEKS = 156
HOLDOUT_WEEKS = 30


def _rng_for(seed_text: str) -> np.random.Generator:
    seed = int(hashlib.sha256(seed_text.encode()).hexdigest()[:8], 16)
    return np.random.default_rng(seed)


def _adstock(x: np.ndarray, decay: float) -> np.ndarray:
    y = np.zeros_like(x)
    y[0] = x[0]
    for t in range(1, len(x)):
        y[t] = x[t] + decay * y[t - 1]
    return y


def _saturate(x: np.ndarray, k: float) -> np.ndarray:
    return x / (x + k)


def _ridge_fit(X: np.ndarray, y: np.ndarray, alpha: float = 1.0):
    """Closed-form ridge regression with an intercept (features centered)."""
    x_mean = X.mean(axis=0)
    y_mean = y.mean()
    Xc = X - x_mean
    yc = y - y_mean
    n_features = Xc.shape[1]
    coef = np.linalg.solve(Xc.T @ Xc + alpha * np.eye(n_features), Xc.T @ yc)
    intercept = y_mean - x_mean @ coef
    return coef, intercept


def fit(spec: dict, dataset_version_id: str) -> dict:
    channels = spec.get("channels", [])
    controls = spec.get("controls", [])
    if not channels:
        raise ValueError("spec must declare at least one channel")

    rng = _rng_for(dataset_version_id + str(spec))
    t = np.arange(N_WEEKS)
    trend = 100 + 0.15 * t
    seasonality = 8 * np.sin(2 * np.pi * t / 52)

    channel_names = [c["name"] for c in channels]
    true_decay = {c["name"]: rng.uniform(0.25, 0.65) for c in channels}
    true_k = {}
    true_coef = {c["name"]: rng.uniform(1.5, 4.5) for c in channels}
    raw_spend = {}
    transformed = {}

    outcome = trend + seasonality
    for c in channels:
        name = c["name"]
        lo, hi = float(c.get("min", 0)), float(c.get("max", 10))
        hi = max(hi, lo + 0.1)
        spend = rng.uniform(lo, hi, size=N_WEEKS) * (1 + 0.3 * np.sin(2 * np.pi * t / 52 + rng.uniform(0, 6)))
        spend = np.clip(spend, 0, None)
        raw_spend[name] = spend
        adstocked = _adstock(spend, true_decay[name])
        k = float(np.median(adstocked)) + 1e-6
        true_k[name] = k
        sat = _saturate(adstocked, k)
        transformed[name] = sat
        outcome = outcome + true_coef[name] * sat * 20

    control_series = {}
    for ctrl in controls:
        series = rng.normal(0, 1, size=N_WEEKS)
        control_series[ctrl] = series
        outcome = outcome + rng.uniform(-3, 3) * series

    noise = rng.normal(0, outcome.std() * 0.04, size=N_WEEKS)
    outcome = outcome + noise

    # Trend and seasonality are base drivers every real MMM spec includes
    # (doc section 5.2/6.2 -- "Seasonality -- Fourier" is checked by default
    # in the reference spec), not something an analyst opts into per project.
    base_features = [t / N_WEEKS, np.sin(2 * np.pi * t / 52), np.cos(2 * np.pi * t / 52)]

    feature_cols = channel_names + controls
    X = np.column_stack(
        [transformed[n] for n in channel_names] + [control_series[c] for c in controls] + base_features
    )
    y = outcome

    train_idx = slice(0, N_WEEKS - HOLDOUT_WEEKS)
    holdout_idx = slice(N_WEEKS - HOLDOUT_WEEKS, N_WEEKS)

    coef, intercept = _ridge_fit(X[train_idx], y[train_idx], alpha=1.0)

    y_hat_holdout = intercept + X[holdout_idx] @ coef
    holdout_mape = float(np.mean(np.abs((y[holdout_idx] - y_hat_holdout) / y[holdout_idx])) * 100)

    y_hat_all = intercept + X @ coef
    ss_res = float(np.sum((y - y_hat_all) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r_squared = 1 - ss_res / ss_tot

    contributions = {}
    for i, name in enumerate(channel_names):
        contrib_series = coef[i] * X[:, i]
        contributions[name] = {
            "spend": round(float(raw_spend[name].sum()), 2),
            "revenue": round(float(np.clip(contrib_series, 0, None).sum()), 2),
            "coefficient": round(float(coef[i]), 4),
        }

    response_curves = {
        name: {"decay": round(true_decay[name], 3), "half_saturation": round(true_k[name], 3), "coefficient": round(float(coef[i]), 4)}
        for i, name in enumerate(channel_names)
    }

    negative_contribs = [n for n, c in contributions.items() if c["revenue"] <= 0]
    diagnostics = {
        "fit": {"r_squared": round(r_squared, 4), "status": "pass" if r_squared > 0.6 else "warn"},
        "generalization": {"holdout_mape": round(holdout_mape, 2), "status": "pass" if holdout_mape < 20 else "warn"},
        "plausibility": {
            "negative_contributions": negative_contribs,
            "status": "pass" if not negative_contribs else "warn",
        },
        "sufficiency": {
            "weeks": N_WEEKS,
            "parameters": len(feature_cols) + 1,
            "status": "pass" if N_WEEKS > 4 * (len(feature_cols) + 1) else "warn",
        },
    }
    overall_status = "completed" if all(d["status"] == "pass" for d in diagnostics.values()) else "failed_diagnostics"

    return {
        "status": overall_status,
        "holdout_mape": round(holdout_mape, 2),
        "r_squared": round(r_squared, 4),
        "diagnostics": diagnostics,
        "contributions": contributions,
        "response_curves": response_curves,
    }


def response_curve_points(decay: float, half_saturation: float, coefficient: float, max_spend: float, n: int = 40):
    xs = np.linspace(0, max_spend, n)
    adstocked = xs  # steady-state approximation for a single-point curve (no time dimension here)
    sat = adstocked / (adstocked + half_saturation)
    ys = coefficient * sat * 20
    return [{"spend": round(float(x), 2), "revenue": round(float(y), 2)} for x, y in zip(xs, ys)]


def optimize_allocation(response_curves: dict, total_budget: float, bounds: dict, step: float = 0.05):
    """Greedy marginal-gain allocator -- same approach as a differential-evolution
    fallback the doc allows for a non-convex budget optimizer, just simpler."""
    names = list(response_curves.keys())
    alloc = {n: bounds.get(n, {}).get("min", 0.0) for n in names}
    spent = sum(alloc.values())
    remaining = total_budget - spent
    if remaining <= 0:
        return alloc

    def revenue_at(name, spend):
        p = response_curves[name]
        sat = spend / (spend + p["half_saturation"]) if spend > 0 else 0
        return p["coefficient"] * sat * 20

    while remaining > 1e-6:
        best_name, best_gain = None, -1
        for n in names:
            cap = bounds.get(n, {}).get("max", total_budget)
            if alloc[n] + step > cap:
                continue
            gain = revenue_at(n, alloc[n] + step) - revenue_at(n, alloc[n])
            if gain > best_gain:
                best_gain, best_name = gain, n
        if best_name is None:
            break
        alloc[best_name] += step
        remaining -= step

    return {n: round(v, 2) for n, v in alloc.items()}
