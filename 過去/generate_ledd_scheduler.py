import xlsxwriter

def generate_excel():
    filename = 'LEDD_Scheduler_v0_1.xlsx'
    workbook = xlsxwriter.Workbook(filename)
    
    # --- Formats ---
    fmt_header = workbook.add_format({'bold': True, 'align': 'center', 'bg_color': '#D9E1F2', 'border': 1})
    fmt_bold = workbook.add_format({'bold': True})
    fmt_border = workbook.add_format({'border': 1})
    fmt_time = workbook.add_format({'num_format': 'hh:mm', 'border': 1})
    fmt_msg = workbook.add_format({'color': 'red', 'italic': True, 'text_wrap': True, 'border': 1, 'bg_color': '#FFF2CC'})
    fmt_num = workbook.add_format({'border': 1})
    
    # -------------------------------------------------------------------------
    # Sheet 1: DrugMaster
    # -------------------------------------------------------------------------
    ws_master = workbook.add_worksheet('DrugMaster')
    headers_master = ["DrugID", "DisplayName", "Category", "Unit", "LEDD_Mode", "LEDD_Factor", "LDOPA_Multiplier", "MaxSingleDose_mg", "MaxDailyDose_mg", "Warnings", "IsActive"]
    
    # Data
    drugs = [
        ["LDOPA_IR", "レボドパ/カルビドパ(IR)", "LDOPA", "mg", "DIRECT", 1.0, 1.0, 200, 1200, "-", True],
        ["LDOPA_BEN_IR", "レボドパ/ベンセラジド(IR)", "LDOPA", "mg", "DIRECT", 1.0, 1.0, 200, 1200, "-", True],
        ["LDOPA_ER", "レボドパ徐放(ER)", "LDOPA", "mg", "DIRECT", 0.7, 1.0, 400, 1600, "単純換算不可", True],
        ["PRAMIPEXOLE", "プラミペキソール", "AGONIST", "mg", "DIRECT", 100.0, 1.0, 4.5, 4.5, "-", True],
        ["ROPINIROLE", "ロピニロール", "AGONIST", "mg", "DIRECT", 20.0, 1.0, 15, 15, "-", True],
        ["ROTIGOTINE", "ロチゴチン貼付", "AGONIST", "patch", "DIRECT", 20.0, 1.0, 18, 18, "24hr持続", True],
        ["SELEGILINE", "セレギリン", "MAOB", "mg/day", "DIRECT", 10.0, 1.0, 10, 10, "-", True],
        ["RASAGILINE", "ラサギリン", "MAOB", "mg/day", "DIRECT", 100.0, 1.0, 1, 1, "-", True],
        ["ENTACAPONE", "エンタカポン", "COMT", "mg", "MULTIPLY_LDOPA", 0, 1.33, 200, 1600, "LDOPA併用", True],
        ["OPICAPONE", "オピカポン", "COMT", "mg", "MULTIPLY_LDOPA", 0, 1.45, 25, 25, "LDOPA併用", True],
        ["AMANTADINE", "アマンタジン", "OTHER", "mg", "FIXED", 0, 1.0, 300, 300, "-", True]
    ]
    
    # Write Table
    ws_master.set_column('B:B', 30)
    ws_master.set_column('A:A', 15)
    ws_master.add_table(0, 0, len(drugs), len(headers_master)-1, {
        'name': 'tblDrugMaster',
        'columns': [{'header': h} for h in headers_master],
        'data': drugs,
        'style': 'Table Style Medium 2'
    })
    
    # -------------------------------------------------------------------------
    # Sheet 2: Input
    # -------------------------------------------------------------------------
    ws_input = workbook.add_worksheet('Input')
    ws_input.set_column('A:A', 20)
    ws_input.set_column('B:B', 15)
    ws_input.set_column('G:G', 20)
    
    # Titles & Disclaimer
    ws_input.write('A1', 'LEDD計算 & スケジュール提案（医師向け）', workbook.add_format({'bold': True, 'font_size': 14}))
    ws_input.merge_range('A2:D2', '本ツールは診療補助目的であり治療方針を決定するものではありません。ER製剤等は単純換算不可。副作用・禁忌は別途確認してください。', fmt_msg)
    
    # Schedule Inputs
    labels = [
        ('A4', '起床', '06:00'),
        ('A5', '就寝', '23:00'),
        ('A7', '朝食', ''),
        ('A8', '昼食', ''),
        ('A9', '夕食', '')
    ]
    for cell, lab, val in labels:
        ws_input.write(cell, lab, fmt_bold)
        ws_input.write(cell.replace('A', 'B'), val, fmt_time if val else fmt_border)

    # Symptom Checks
    symptoms = [
        ('D4', 'wearing-off', False),
        ('D5', 'ジスキネジア', False),
        ('D6', '朝OFF/delayed-on', False),
        ('D7', '夜間〜早朝OFF', False),
        ('D8', '服薬回数を減らしたい', False),
        ('D9', '眠気/精神症状が心配', False)
    ]
    for cell, lab, val in symptoms:
        ws_input.write(cell, lab, fmt_bold)
        ws_input.write(cell.replace('D', 'E'), val, fmt_border)
        ws_input.data_validation(cell.replace('D', 'E'), {'validate': 'list', 'source': ['TRUE', 'FALSE']})

    # Button Placeholder (Note: macros must be added separately, but we add the shape)
    ws_input.insert_button('G4', {'macro': 'Recalc_All', 'caption': '計算・提案生成', 'width': 200, 'height': 40})

    # Rx Table
    headers_rx = ["Drug", "Dose", "Freq", "Time1", "Time2", "Time3", "Time4", "Time5", "Notes", "LEDD", "Category"]
    start_row = 11 # A12 is row 11
    start_col = 0
    num_rows = 5
    
    ws_input.set_column('A:A', 25) # Drug column wider
    
    # Add Table
    ws_input.add_table(start_row, start_col, start_row + num_rows, len(headers_rx)-1, {
        'name': 'tblRx',
        'columns': [{'header': h} for h in headers_rx],
        'style': 'Table Style Light 9'
    })
    
    # Data Validation for Drug column (A12:A17)
    # Using INDIRECT to reference the other table column
    ws_input.data_validation(start_row+1, 0, start_row+num_rows, 0, {
        'validate': 'list',
        'source': '=INDIRECT("tblDrugMaster[DisplayName]")'
    })
    
    # -------------------------------------------------------------------------
    # Sheet 3: Output
    # -------------------------------------------------------------------------
    ws_output = workbook.add_worksheet('Output')
    ws_output.set_column('A:Q', 12)
    
    # Summary
    ws_output.write('A1', 'Results', fmt_header)
    summary_labels = ['LEDD(LDOPA調整後)', 'LEDD(Agonist)', 'LEDD(Other)', 'LEDD Total']
    for i, lab in enumerate(summary_labels):
        ws_output.write(2+i, 0, lab, fmt_bold)
        ws_output.write(2+i, 1, 0, fmt_num)
    
    # Plan Areas
    # Plan A: A10:E50
    ws_output.merge_range('A9:E9', 'Plan A（均等割り）', fmt_header)
    ws_output.write_row('A10', ['Time', 'Drug', 'Dose', 'Comment', ''], fmt_bold)
    
    # Plan B: G10:K50
    ws_output.merge_range('G9:K9', 'Plan B（OFF対策）', fmt_header)
    ws_output.write_row('G10', ['Time', 'Drug', 'Dose', 'Comment', ''], fmt_bold)
    
    # Plan C: M10:Q50
    ws_output.merge_range('M9:Q9', 'Plan C（ピーク抑制）', fmt_header)
    ws_output.write_row('M10', ['Time', 'Drug', 'Dose', 'Comment', ''], fmt_bold)

    workbook.close()
    print(f"Created {filename}")

if __name__ == '__main__':
    generate_excel()
