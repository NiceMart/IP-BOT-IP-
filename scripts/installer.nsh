!include "LogicLib.nsh"

!define LEGACY_APP_GUID "3a51f54f-dd33-55a2-a302-8f716620a296"
!define LEGACY_INSTALL_KEY "Software\${LEGACY_APP_GUID}"
!define LEGACY_UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${LEGACY_APP_GUID}"
!define LEGACY_UNINSTALL_KEY_WOW64 "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\${LEGACY_APP_GUID}"

Var OldInstallDir
Var OldBundleDir
Var BundleBackupDir
Var UpgradePreparationDone

Function LegacyGetInQuotes
  Exch $R0
  Push $R1
  Push $R2
  Push $R3

   StrCpy $R2 -1
   IntOp $R2 $R2 + 1
    StrCpy $R3 $R0 1 $R2
    StrCmp $R3 "" 0 +3
     StrCpy $R0 ""
     Goto legacy_get_in_quotes_done
    StrCmp $R3 '"' 0 -5

   IntOp $R2 $R2 + 1
   StrCpy $R0 $R0 "" $R2

   StrCpy $R2 0
   IntOp $R2 $R2 + 1
    StrCpy $R3 $R0 1 $R2
    StrCmp $R3 "" 0 +3
     StrCpy $R0 ""
     Goto legacy_get_in_quotes_done
    StrCmp $R3 '"' 0 -5

   StrCpy $R0 $R0 $R2
   legacy_get_in_quotes_done:

  Pop $R3
  Pop $R2
  Pop $R1
  Exch $R0
FunctionEnd

Function LegacyGetFileParent
  Exch $R0
  Push $R1
  Push $R2
  Push $R3

  StrCpy $R1 0
  StrLen $R2 $R0

  legacy_get_parent_loop:
    IntOp $R1 $R1 + 1
    IntCmp $R1 $R2 legacy_get_parent_done 0 legacy_get_parent_done
    StrCpy $R3 $R0 1 -$R1
    StrCmp $R3 "\" legacy_get_parent_done
  Goto legacy_get_parent_loop

  legacy_get_parent_done:
    StrCpy $R0 $R0 -$R1

    Pop $R3
    Pop $R2
    Pop $R1
    Exch $R0
FunctionEnd

Function ResolveLegacyInstallDirFromUninstallString
  Exch $0
  Push $1
  Push $2

  StrCpy $1 ""
  ${If} $0 == ""
    Goto resolve_legacy_dir_done
  ${EndIf}

  StrCpy $2 $0 1
  ${If} $2 == '"'
    Push $0
    Call LegacyGetInQuotes
    Pop $1
  ${Else}
    StrCpy $1 $0
  ${EndIf}

  ${If} $1 != ""
    Push $1
    Call LegacyGetFileParent
    Pop $1
  ${EndIf}

  resolve_legacy_dir_done:
  Pop $2
  Exch $1
FunctionEnd

Function ApplyLegacyInstallDirCandidate
  Exch $0

  ${If} $0 != ""
  ${AndIf} ${FileExists} "$0\*.*"
    StrCpy $OldInstallDir "$0"
    StrCpy $OldBundleDir "$OldInstallDir\resources-bundles"
    StrCpy $INSTDIR "$OldInstallDir"
  ${EndIf}

  Exch $0
FunctionEnd

Function ResolveLegacyInstallDir
  ${If} $OldInstallDir != ""
  ${AndIf} ${FileExists} "$OldInstallDir\*.*"
    StrCpy $INSTDIR "$OldInstallDir"
    Return
  ${EndIf}

  StrCpy $OldInstallDir ""
  StrCpy $OldBundleDir ""

  ReadRegStr $0 HKCU "${LEGACY_INSTALL_KEY}" "InstallLocation"
  Push $0
  Call ApplyLegacyInstallDirCandidate
  Pop $0
  ${If} $OldInstallDir == ""
    ReadRegStr $0 HKLM "${LEGACY_INSTALL_KEY}" "InstallLocation"
    Push $0
    Call ApplyLegacyInstallDirCandidate
    Pop $0
  ${EndIf}

  ${If} $OldInstallDir == ""
    ReadRegStr $0 HKCU "${LEGACY_UNINSTALL_KEY}" "InstallLocation"
    Push $0
    Call ApplyLegacyInstallDirCandidate
    Pop $0
  ${EndIf}
  ${If} $OldInstallDir == ""
    ReadRegStr $0 HKLM "${LEGACY_UNINSTALL_KEY}" "InstallLocation"
    Push $0
    Call ApplyLegacyInstallDirCandidate
    Pop $0
  ${EndIf}
  ${If} $OldInstallDir == ""
    ReadRegStr $0 HKLM "${LEGACY_UNINSTALL_KEY_WOW64}" "InstallLocation"
    Push $0
    Call ApplyLegacyInstallDirCandidate
    Pop $0
  ${EndIf}

  ${If} $OldInstallDir == ""
    ReadRegStr $0 HKCU "${LEGACY_UNINSTALL_KEY}" "UninstallString"
    Push $0
    Call ResolveLegacyInstallDirFromUninstallString
    Pop $0
    Push $0
    Call ApplyLegacyInstallDirCandidate
    Pop $0
  ${EndIf}
  ${If} $OldInstallDir == ""
    ReadRegStr $0 HKLM "${LEGACY_UNINSTALL_KEY}" "UninstallString"
    Push $0
    Call ResolveLegacyInstallDirFromUninstallString
    Pop $0
    Push $0
    Call ApplyLegacyInstallDirCandidate
    Pop $0
  ${EndIf}
  ${If} $OldInstallDir == ""
    ReadRegStr $0 HKLM "${LEGACY_UNINSTALL_KEY_WOW64}" "UninstallString"
    Push $0
    Call ResolveLegacyInstallDirFromUninstallString
    Pop $0
    Push $0
    Call ApplyLegacyInstallDirCandidate
    Pop $0
  ${EndIf}

  ${If} $OldInstallDir != ""
    DetailPrint "Legacy install dir: $OldInstallDir"
  ${EndIf}
FunctionEnd

Function ClearLegacyRegistry
  DeleteRegKey HKCU "${LEGACY_UNINSTALL_KEY}"
  DeleteRegKey HKLM "${LEGACY_UNINSTALL_KEY}"
  DeleteRegKey HKLM "${LEGACY_UNINSTALL_KEY_WOW64}"
  DeleteRegKey HKCU "${LEGACY_INSTALL_KEY}"
  DeleteRegKey HKLM "${LEGACY_INSTALL_KEY}"
FunctionEnd

Function RemoveDirectoryDeep
  Exch $0

  ${If} $0 == ""
    Return
  ${EndIf}

  ClearErrors
  RMDir /r "$0"
  ClearErrors
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$$target = ''\\?\'' + [System.IO.Path]::GetFullPath(''$0''); try { Remove-Item -LiteralPath $$target -Recurse -Force -ErrorAction Stop } catch {}"'
  Pop $1

  Exch $0
FunctionEnd

Function KillDirectAppProcesses
  nsExec::ExecToLog 'taskkill /F /IM "${PRODUCT_FILENAME}.exe" /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM "SC-IP-Agent.exe" /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM "尚创IP智能体V8.exe" /T'
  Pop $0
FunctionEnd

Function KillProcessesUnderLegacyInstall
  Call KillDirectAppProcesses

  ${If} $OldInstallDir == ""
    Return
  ${EndIf}

  DetailPrint "Closing processes under $OldInstallDir"
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "$$root = [System.IO.Path]::GetFullPath(''$OldInstallDir''); Get-Process -ErrorAction SilentlyContinue | Where-Object { try { $$path = $$_.Path; if (-not $$path) { return $$false }; [System.IO.Path]::GetFullPath($$path).StartsWith($$root, [System.StringComparison]::OrdinalIgnoreCase) } catch { $$false } } | ForEach-Object { try { Stop-Process -Id $$_.Id -Force -ErrorAction Stop } catch {} }"'
  Pop $0
  Sleep 1200

  Call KillDirectAppProcesses
  Sleep 800
FunctionEnd

Function BackupLegacyResourceBundles
  ${If} $OldBundleDir == ""
    Return
  ${EndIf}

  StrCpy $BundleBackupDir "$OldInstallDir.__resources-bundles-backup"
  ${If} ${FileExists} "$BundleBackupDir\*.*"
    ${IfNot} ${FileExists} "$OldBundleDir\*.*"
      DetailPrint "Reusing preserved resource bundles from $BundleBackupDir"
      Return
    ${EndIf}
  ${EndIf}

  ${IfNot} ${FileExists} "$OldBundleDir\*.*"
    Return
  ${EndIf}

  Push "$BundleBackupDir"
  Call RemoveDirectoryDeep

  DetailPrint "Preserving resource bundles to $BundleBackupDir"
  Rename "$OldBundleDir" "$BundleBackupDir"
  ${If} ${Errors}
    ClearErrors
    nsExec::ExecToLog 'robocopy "$OldBundleDir" "$BundleBackupDir" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP'
    Pop $0
  ${EndIf}
FunctionEnd

Function RestorePreservedResourceBundles
  ${If} $BundleBackupDir == ""
    Return
  ${EndIf}

  ${IfNot} ${FileExists} "$BundleBackupDir\*.*"
    Return
  ${EndIf}

  DetailPrint "Restoring preserved resource bundles"
  Push "$INSTDIR\resources-bundles"
  Call RemoveDirectoryDeep
  Rename "$BundleBackupDir" "$INSTDIR\resources-bundles"
  ${If} ${Errors}
    ClearErrors
    CreateDirectory "$INSTDIR\resources-bundles"
    nsExec::ExecToLog 'robocopy "$BundleBackupDir" "$INSTDIR\resources-bundles" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP'
    Pop $0
    Push "$BundleBackupDir"
    Call RemoveDirectoryDeep
  ${EndIf}
FunctionEnd

Function RunUpgradePreparation
  ${If} $UpgradePreparationDone == "true"
    Return
  ${EndIf}

  Call ResolveLegacyInstallDir
  ${If} $OldInstallDir == ""
    StrCpy $UpgradePreparationDone "true"
    Return
  ${EndIf}

  Call KillProcessesUnderLegacyInstall
  Call BackupLegacyResourceBundles
  Call ClearLegacyRegistry
  StrCpy $UpgradePreparationDone "true"
FunctionEnd

!macro customCheckAppRunning
  !ifdef BUILD_UNINSTALLER
    DetailPrint "Closing running application..."
    nsExec::ExecToLog 'taskkill /F /IM "${PRODUCT_FILENAME}.exe" /T'
    Pop $0
    nsExec::ExecToLog 'taskkill /F /IM "SC-IP-Agent.exe" /T'
    Pop $0
    nsExec::ExecToLog 'taskkill /F /IM "尚创IP智能体V8.exe" /T'
    Pop $0
  !else
    DetailPrint "Preparing in-place upgrade..."
    Call RunUpgradePreparation
    DetailPrint "Upgrade preparation complete"
  !endif
!macroend

!macro customInit
  Call ResolveLegacyInstallDir

  IfSilent skip_vcredist 0
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  StrCmp $0 "1" skip_vcredist
  MessageBox MB_YESNO "检测到系统缺少 Visual C++ 运行库，是否安装？" IDYES install_vcredist IDNO skip_vcredist
  install_vcredist:
    SetOutPath "$TEMP"
    File "${BUILD_RESOURCES_DIR}\vc_redist.x64.exe"
    ExecWait '"$TEMP\vc_redist.x64.exe" /install /quiet /norestart' $1
    Delete "$TEMP\vc_redist.x64.exe"
  skip_vcredist:

  Call RunUpgradePreparation
!macroend

!macro customInstall
  DetailPrint "Running final upgrade checks..."
  Call KillProcessesUnderLegacyInstall
  Call RestorePreservedResourceBundles
!macroend

!macro customUnInit
  DetailPrint "Closing running application..."
  nsExec::ExecToLog 'taskkill /F /IM "${PRODUCT_FILENAME}.exe" /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM "SC-IP-Agent.exe" /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM "尚创IP智能体V8.exe" /T'
  Pop $0
!macroend
