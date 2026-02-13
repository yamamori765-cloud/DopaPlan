Attribute VB_Name = "ModuleLEDD"
Option Explicit

' ---------------------------------------------------------
' LEDD Scheduler Logic
' Version: 0.6 (Fixed Type definition scope/position)
' ---------------------------------------------------------

' --- Data Structures (Must be at top) ---
Private Type ScheduleItem
    Time As Date
    Drug As String
    Dose As Double
    Comment As String
End Type

' --- Main Macros ---

Public Sub Recalc_All()
    On Error GoTo ErrorHandler
    
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    
    ' 1. Calculate LEDD for each Rx row
    Compute_LEDD_For_Rx
    
    ' 2. Update Summary
    Write_LEDD_Summary
    
    ' 3. Generate Schedules
    Generate_Schedules
    
    MsgBox "計算と提案生成が完了しました。", vbInformation, "完了"
    
ExitHandler:
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    Exit Sub
    
ErrorHandler:
    MsgBox "エラーが発生しました: " & Err.Description & vbCrLf & "Source: " & Err.Source, vbCritical
    Resume ExitHandler
End Sub

Public Sub Reset_Inputs()
    Dim wsInput As Worksheet, wsOutput As Worksheet
    Dim tblRx As ListObject
    
    If MsgBox("入力内容をすべてリセットしますか？" & vbCrLf & "（処方、症状チェック、計算結果がクリアされます）", vbQuestion + vbYesNo, "リセット確認") = vbNo Then
        Exit Sub
    End If

    Application.ScreenUpdating = False
    
    Set wsInput = ThisWorkbook.Sheets("Input")
    Set wsOutput = ThisWorkbook.Sheets("Output")
    Set tblRx = wsInput.ListObjects("tblRx")
    
    ' 1. Clear Rx Table Body
    If Not tblRx.DataBodyRange Is Nothing Then
        tblRx.DataBodyRange.ClearContents
    End If
    
    ' 2. Clear Symptom Checks (E4:E9)
    wsInput.Range("E4:E9").Value = False
    
    ' 3. Clear Meal Times (keep Wake/Sleep)
    wsInput.Range("B7:B9").ClearContents
    
    ' 4. Clear Output Results
    wsOutput.Range("B3:B6").Value = 0
    wsOutput.Range("A10:E50").ClearContents
    wsOutput.Range("G10:K50").ClearContents
    wsOutput.Range("M10:Q50").ClearContents
    
    Application.ScreenUpdating = True
    MsgBox "リセットしました。", vbInformation
End Sub

' --- Logic Procedures ---

Private Sub Compute_LEDD_For_Rx()
    Dim wsInput As Worksheet
    Dim wsMaster As Worksheet
    Dim tblRx As ListObject
    Dim tblMaster As ListObject
    Dim rRx As ListRow
    Dim drugName As String
    Dim dose As Double, freq As Double
    Dim leddValue As Double
    Dim drugCat As String, drugMode As String
    Dim leddFactor As Double
    Dim foundMaster As Range
    
    Set wsInput = ThisWorkbook.Sheets("Input")
    Set wsMaster = ThisWorkbook.Sheets("DrugMaster")
    Set tblRx = wsInput.ListObjects("tblRx")
    Set tblMaster = wsMaster.ListObjects("tblDrugMaster")
    
    If tblRx.DataBodyRange Is Nothing Then Exit Sub
    
    For Each rRx In tblRx.ListRows
        drugName = rRx.Range(1, 1).Value
        dose = Val(rRx.Range(1, 2).Value)
        freq = Val(rRx.Range(1, 3).Value)
        
        If drugName <> "" Then
            Set foundMaster = tblMaster.ListColumns("DisplayName").DataBodyRange.Find(drugName, LookIn:=xlValues, LookAt:=xlWhole)
            
            If Not foundMaster Is Nothing Then
                Dim rowIndex As Long
                rowIndex = foundMaster.Row - tblMaster.HeaderRowRange.Row
                
                drugCat = tblMaster.ListColumns("Category").DataBodyRange(rowIndex).Value
                drugMode = tblMaster.ListColumns("LEDD_Mode").DataBodyRange(rowIndex).Value
                leddFactor = Val(tblMaster.ListColumns("LEDD_Factor").DataBodyRange(rowIndex).Value)
                
                If drugMode = "DIRECT" Then
                    leddValue = dose * freq * leddFactor
                Else
                    leddValue = 0
                End If
                
                rRx.Range(1, 10).Value = leddValue
                rRx.Range(1, 11).Value = drugCat
            Else
                rRx.Range(1, 10).Value = 0
                rRx.Range(1, 11).Value = "UNKNOWN"
            End If
        Else
            rRx.Range(1, 10).ClearContents
            rRx.Range(1, 11).ClearContents
        End If
    Next rRx
End Sub

Private Sub Write_LEDD_Summary()
    Dim wsInput As Worksheet, wsOutput As Worksheet
    Dim tblRx As ListObject, tblMaster As ListObject
    Dim rRx As ListRow
    Dim sumLDOPA As Double, sumAgonist As Double, sumOther As Double
    Dim ldopaMultiplier As Double
    Dim drugName As String, drugMode As String
    Dim masterMult As Double
    Dim foundMaster As Range
    
    Set wsInput = ThisWorkbook.Sheets("Input")
    Set wsOutput = ThisWorkbook.Sheets("Output")
    Set tblRx = wsInput.ListObjects("tblRx")
    Set tblMaster = ThisWorkbook.Sheets("DrugMaster").ListObjects("tblDrugMaster")
    
    sumLDOPA = 0
    sumAgonist = 0
    sumOther = 0
    ldopaMultiplier = 1#
    
    If tblRx.DataBodyRange Is Nothing Then GoTo WriteResults
    
    For Each rRx In tblRx.ListRows
        drugName = rRx.Range(1, 1).Value
        If drugName <> "" Then
            Dim cat As String: cat = rRx.Range(1, 11).Value
            Dim leddValue As Double: leddValue = rRx.Range(1, 10).Value
            
            Select Case cat
                Case "LDOPA": sumLDOPA = sumLDOPA + leddValue
                Case "AGONIST": sumAgonist = sumAgonist + leddValue
                Case "MAOB", "OTHER": sumOther = sumOther + leddValue
                Case "COMT"
                    Set foundMaster = tblMaster.ListColumns("DisplayName").DataBodyRange.Find(drugName, LookAt:=xlWhole)
                    If Not foundMaster Is Nothing Then
                        Dim rIdx As Long: rIdx = foundMaster.Row - tblMaster.HeaderRowRange.Row
                        drugMode = tblMaster.ListColumns("LEDD_Mode").DataBodyRange(rIdx).Value
                        masterMult = Val(tblMaster.ListColumns("LDOPA_Multiplier").DataBodyRange(rIdx).Value)
                        
                        If drugMode = "MULTIPLY_LDOPA" Then
                            If masterMult > ldopaMultiplier Then ldopaMultiplier = masterMult
                        End If
                    End If
            End Select
        End If
    Next rRx
    
WriteResults:
    Dim finalLDOPA As Double
    finalLDOPA = sumLDOPA * ldopaMultiplier
    
    wsOutput.Range("B3").Value = finalLDOPA
    wsOutput.Range("B4").Value = sumAgonist
    wsOutput.Range("B5").Value = sumOther
    wsOutput.Range("B6").Value = finalLDOPA + sumAgonist + sumOther
    
End Sub

Private Sub Generate_Schedules()
    Dim wsInput As Worksheet, wsOutput As Worksheet
    Dim tblRx As ListObject
    Dim wakeTime As Date, sleepTime As Date
    Dim rRx As ListRow
    Dim mainDrug As String
    Dim mainDose As Double, mainFreq As Integer
    Dim i As Integer
    Dim itemsA() As ScheduleItem, itemsB() As ScheduleItem, itemsC() As ScheduleItem
    Dim cntA As Integer, cntB As Integer, cntC As Integer
    
    Set wsInput = ThisWorkbook.Sheets("Input")
    Set wsOutput = ThisWorkbook.Sheets("Output")
    Set tblRx = wsInput.ListObjects("tblRx")
    
    ' Read Times
    On Error Resume Next
    wakeTime = wsInput.Range("B4").Value
    sleepTime = wsInput.Range("B5").Value
    On Error GoTo 0
    
    If wakeTime = 0 Or sleepTime = 0 Then Exit Sub
    
    ' Clear Output Areas
    wsOutput.Range("A10:E50").ClearContents
    wsOutput.Range("G10:K50").ClearContents
    wsOutput.Range("M10:Q50").ClearContents
    
    ' --- 1. Identify Main LDOPA & Collect Others ---
    mainDrug = ""
    Dim otherRows As Collection
    Set otherRows = New Collection
    
    If Not tblRx.DataBodyRange Is Nothing Then
        For Each rRx In tblRx.ListRows
            If rRx.Range(1, 1).Value <> "" Then
                ' Identify first LDOPA as Main
                If rRx.Range(1, 11).Value = "LDOPA" And mainDrug = "" Then
                    mainDrug = rRx.Range(1, 1).Value
                    mainDose = Val(rRx.Range(1, 2).Value)
                    mainFreq = Val(rRx.Range(1, 3).Value)
                Else
                    ' All others (including 2nd LDOPA, Agonists, COMT) are "Other"
                    otherRows.Add rRx
                End If
            End If
        Next rRx
    End If
    
    ' If no main drug, we can't generate a base schedule easily
    If mainDrug = "" Then Exit Sub
    
    ' --- 2. Generate Base L-Dopa Schedule (A/B/C) ---
    Dim dayDuration As Double
    dayDuration = sleepTime - wakeTime
    If dayDuration < 0 Then dayDuration = dayDuration + 1
    
    ' Initialize Arrays (SAFE SIZE)
    ReDim itemsA(1 To 50)
    ReDim itemsB(1 To 50)
    ReDim itemsC(1 To 50)
    cntA = 0: cntB = 0: cntC = 0
    
    Dim isWearingOff As Boolean: isWearingOff = (wsInput.Range("E4").Value = True) Or (wsInput.Range("E6").Value = True)
    Dim isDyskinesia As Boolean: isDyskinesia = (wsInput.Range("E5").Value = True)
    
    ' [Plan A] Uniform
    Dim intA As Double: intA = dayDuration / mainFreq
    For i = 1 To mainFreq
        cntA = cntA + 1
        itemsA(cntA).Time = RoundTo15(wakeTime + (i - 1) * intA)
        itemsA(cntA).Drug = mainDrug
        itemsA(cntA).Dose = mainDose
        itemsA(cntA).Comment = "定時"
    Next i
    
    ' [Plan B] OFF Strategy
    Dim intB1 As Double, intB_Rest As Double, currB As Date
    currB = wakeTime
    If isWearingOff Then
        intB1 = intA * 0.85
        intB_Rest = (dayDuration - intB1) / (mainFreq - 1)
        
        cntB = cntB + 1
        itemsB(cntB).Time = (RoundTo15(currB))
        itemsB(cntB).Drug = mainDrug
        itemsB(cntB).Dose = mainDose
        itemsB(cntB).Comment = "起床時"
        
        currB = currB + intB1
        For i = 2 To mainFreq
            cntB = cntB + 1
            itemsB(cntB).Time = RoundTo15(currB)
            itemsB(cntB).Drug = mainDrug
            itemsB(cntB).Dose = mainDose
            itemsB(cntB).Comment = IIf(i = 2, "間隔短縮", "定時")
            currB = currB + intB_Rest
        Next i
    Else
        ' Copy A
        For i = 1 To cntA
            cntB = cntB + 1
            itemsB(cntB) = itemsA(i)
        Next i
    End If
    
    ' [Plan C] Peak/Dyskinesia (Freq+1)
    Dim freqC As Integer: freqC = mainFreq
    If isDyskinesia Then freqC = freqC + 1
    Dim intC As Double: intC = dayDuration / freqC
    For i = 1 To freqC
        cntC = cntC + 1
        itemsC(cntC).Time = RoundTo15(wakeTime + (i - 1) * intC)
        itemsC(cntC).Drug = mainDrug
        itemsC(cntC).Dose = mainDose
        itemsC(cntC).Comment = IIf(isDyskinesia, "回数増", "標準")
    Next i
    
    ' --- 3. Add Other Drugs ---
    Dim rOther As ListRow
    For Each rOther In otherRows
        Dim dName As String: dName = rOther.Range(1, 1).Value
        Dim dDose As Double: dDose = Val(rOther.Range(1, 2).Value)
        Dim dFreq As Double: dFreq = Val(rOther.Range(1, 3).Value)
        Dim dCat As String: dCat = rOther.Range(1, 11).Value
        
        Dim k As Integer
        Dim isSyncWithMain As Boolean
        isSyncWithMain = (dFreq = mainFreq)
        
        For k = 1 To dFreq
            Dim tItem As Date
            Dim manualTime As Variant
            manualTime = rOther.Range(1, 4 + (k - 1)).Value
            
            If IsDate(manualTime) And manualTime <> 0 Then
                tItem = CDate(manualTime)
                AddToPlan itemsA, cntA, tItem, dName, dDose, "固定(入力)"
                AddToPlan itemsB, cntB, tItem, dName, dDose, "固定(入力)"
                AddToPlan itemsC, cntC, tItem, dName, dDose, "固定(入力)"
            Else
                If isSyncWithMain Then
                    AddToPlan itemsA, cntA, itemsA(k).Time, dName, dDose, "併用"
                    AddToPlan itemsB, cntB, itemsB(k).Time, dName, dDose, "併用"
                    If k <= cntC Then
                        AddToPlan itemsC, cntC, itemsC(k).Time, dName, dDose, "併用"
                    End If
                Else
                    tItem = RoundTo15(wakeTime + (k - 1) * (dayDuration / dFreq))
                    If dFreq = 1 And dName Like "*貼付*" Then tItem = wakeTime
                    If dFreq = 1 And (dName Like "*オピカポン*" Or dName Like "*Opicapone*") Then tItem = sleepTime
                    
                    AddToPlan itemsA, cntA, tItem, dName, dDose, "固定(自動)"
                    AddToPlan itemsB, cntB, tItem, dName, dDose, "固定(自動)"
                    AddToPlan itemsC, cntC, tItem, dName, dDose, "固定(自動)"
                End If
            End If
        Next k
    Next rOther
    
    ' --- 4. Sort and Write ---
    SortAndWrite wsOutput, itemsA, cntA, 1
    SortAndWrite wsOutput, itemsB, cntB, 7
    SortAndWrite wsOutput, itemsC, cntC, 13
    
End Sub

Private Sub AddToPlan(ByRef items() As ScheduleItem, ByRef cnt As Integer, t As Date, d As String, dose As Double, c As String)
    cnt = cnt + 1
    items(cnt).Time = t
    items(cnt).Drug = d
    items(cnt).Dose = dose
    items(cnt).Comment = c
End Sub

Private Sub SortAndWrite(ws As Worksheet, items() As ScheduleItem, count As Integer, startCol As Integer)
    Dim i As Integer, j As Integer
    Dim temp As ScheduleItem
    
    For i = 1 To count - 1
        For j = i + 1 To count
            If items(j).Time < items(i).Time Then
                temp = items(i)
                items(i) = items(j)
                items(j) = temp
            End If
        Next j
    Next i
    
    For i = 1 To count
        Dim r As Integer: r = 9 + i
        ws.Cells(r, startCol).Value = Format(items(i).Time, "hh:mm")
        ws.Cells(r, startCol + 1).Value = items(i).Drug
        ws.Cells(r, startCol + 2).Value = items(i).Dose
        ws.Cells(r, startCol + 3).Value = items(i).Comment
    Next i
End Sub

Public Function RoundTo15(t As Date) As Date
    Dim dTotalMin As Double
    dTotalMin = Hour(t) * 60 + Minute(t)
    
    Dim dRounded As Double
    dRounded = Round(dTotalMin / 15) * 15
    
    RoundTo15 = TimeSerial(Int(dRounded / 60), dRounded Mod 60, 0)
End Function
