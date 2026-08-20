Set objShell = CreateObject("WScript.Shell")
batPath = "D:\Path\To\workbuddy-skin-dev\WorkBuddy-森系.bat"
' 0 = 隐藏窗口; False = 不等待 bat 结束(立即返回, vbs 自身退出)
objShell.Run """" & batPath & """", 0, False
