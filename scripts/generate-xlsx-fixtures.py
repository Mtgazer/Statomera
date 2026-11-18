"""Generate the synthetic workbook fixtures with openpyxl and Python's ZIP writer."""
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from re import subn
from zipfile import ZipFile, ZIP_DEFLATED

from openpyxl import Workbook

root = Path(__file__).resolve().parents[1] / 'tests' / 'fixtures'

wb = Workbook()
sheet = wb.active
sheet.title = 'مبيعات'
sheet.append(['رمز', 'amount', 'day', 'active'])
sheet.append(['001', 10, date(2024, 2, 29), True])
sheet.append(['002', 30, date(2024, 3, 1), False])
sheet.append(['003', None, date(2024, 3, 2), None])
sheet.append(['004', '=1+1', None, '#DIV/0!'])
sheet = wb.create_sheet('Second')
sheet.append(['label', 'amount'])
sheet.append(['شمال', 40])
sheet.append(['جنوب', 60])
sheet = wb.create_sheet('Merged')
sheet.append(['label', 'amount'])
sheet.append(['test', 10])
sheet.merge_cells('A2:B2')
sheet = wb.create_sheet('Uncached')
sheet.append(['label', 'amount'])
sheet.append(['test', '=5+5'])
sheet = wb.create_sheet('Timestamp')
sheet.append(['label', 'day'])
sheet.append(['test', datetime(2024, 1, 1, 12, 30)])

buffer = BytesIO()
wb.save(buffer)
with ZipFile(buffer) as source, ZipFile(root / 'worksheets.xlsx', 'w', ZIP_DEFLATED) as target:
    for name in source.namelist():
        data = source.read(name)
        if name == 'xl/worksheets/sheet1.xml':
            data, count = subn(rb'(<f>1\+1</f>)(?:<v></v>|<v\s*/>)', rb'\1<v>2</v>', data)
            assert count == 1, data
        target.writestr(name, data)
with ZipFile(root / 'oversize-workbook.xlsx', 'w', ZIP_DEFLATED) as target:
    target.writestr('xl/workbook.xml', b' ' * (4 * 1024 * 1024 + 1))
