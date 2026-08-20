On Error Resume Next
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

user = shell.ExpandEnvironmentStrings("%USERPROFILE%")
base = user & "\.workbuddy\binaries\node\versions"
nodeExe = ""

If fso.FolderExists(base) Then
  Set f = fso.GetFolder(base)
  For Each sub In f.SubFolders
    p = sub.Path & "\node.exe"
    If fso.FileExists(p) Then nodeExe = p
  Next
End If

If nodeExe = "" Then
  Set oExec = shell.Exec("cmd /c where node 2>nul")
  If Not oExec.StdOut.AtEndOfStream Then nodeExe = Trim(oExec.StdOut.ReadLine())
End If

If nodeExe = "" Or Not fso.FileExists(nodeExe) Then
  MsgBox "未找到 Node.js（WorkBuddy 自带）。请确认 WorkBuddy 已正确安装。", vbCritical, "森系启动器"
  WScript.Quit 1
End If

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
launch = scriptDir & "\forest-launch.mjs"
If Not fso.FileExists(launch) Then
  MsgBox "缺少 forest-launch.mjs，请确认解压完整。", vbCritical, "森系启动器"
  WScript.Quit 1
End If

' 0 = 隐藏窗口; False = 不等待（双击即走，后台静默完成）
shell.Run """" & nodeExe & """ """ & launch & """", 0, False
