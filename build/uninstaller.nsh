!macro customUnInstall
  MessageBox MB_YESNO "Do you want to remove your saved data (games, characters, and combos)?$\r$\nThis cannot be undone." /SD IDNO IDYES removeData IDNO keepData

  removeData:
    RMDir /r "$APPDATA\notation-labs"
    Goto done

  keepData:
    ; User chose to keep their data

  done:
!macroend
