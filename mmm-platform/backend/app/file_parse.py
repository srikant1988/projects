"""Parses an uploaded Excel/CSV data source: header row, row/column counts
for the "Add source" flow's honest status display, and the full set of
parsed values (`rows`) so a Dataset Version can later be issued from real
numbers instead of a synthesized panel (see engine.py). Column headers are
kept as-is; cell values are coerced to JSON-safe types (dates -> ISO
strings, everything else left as number/str/bool/None).
"""
import csv
import datetime
import io

import openpyxl

MAX_ROWS = 5000  # generous for a weekly MMM panel; guards against pathological uploads


class ParseError(ValueError):
    pass


def _to_jsonable(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()
    return v


def parse_upload(filename: str, content: bytes) -> dict:
    lower = filename.lower()
    if lower.endswith(".csv"):
        return _parse_csv(content)
    if lower.endswith(".xlsx"):
        return _parse_xlsx(content)
    raise ParseError("Only .csv and .xlsx files are supported")


def _parse_csv(content: bytes) -> dict:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise ParseError("Could not decode file as UTF-8 text") from e
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise ParseError("File is empty")
    header = [c.strip() for c in rows[0]]
    data_rows = [r for r in rows[1:] if any(c.strip() for c in r)][:MAX_ROWS]

    def coerce(v: str):
        v = v.strip()
        if v == "":
            return None
        try:
            return int(v)
        except ValueError:
            pass
        try:
            return float(v)
        except ValueError:
            return v

    values = [[coerce(v) for v in r] for r in data_rows]
    return {"columns": header, "row_count": len(data_rows), "rows": values}


def _parse_xlsx(content: bytes) -> dict:
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as e:
        raise ParseError("Could not read this file as an .xlsx workbook") from e
    ws = wb[wb.sheetnames[0]]
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration:
        raise ParseError("Sheet is empty")
    header = [str(c).strip() if c is not None else "" for c in header_row]
    values = []
    for row in rows_iter:
        if any(c is not None and str(c).strip() != "" for c in row):
            values.append([_to_jsonable(c) for c in row])
        if len(values) >= MAX_ROWS:
            break
    wb.close()
    return {"columns": header, "row_count": len(values), "rows": values}
