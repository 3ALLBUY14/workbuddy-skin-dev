Set objShell = CreateObject("WScript.Shell")
batPath = "D:\编程\开发软件皮肤\WorkBuddy-森系.bat"
' 0 = 隐藏窗口; False = 不等待 bat 结束(立即返回, vbs 自身退出)
objShell.Run """" & batPath & """", 0, False
