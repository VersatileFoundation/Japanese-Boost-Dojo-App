#define MyAppName "Japanese Boost Dojo App"
#define MyAppVersion "1.0"
#define MyAppPublisher "Versatile Foundation"
#define MyAppURL "https://hiragana-practice.replit.app/"
#define MyAppExeName "Japanese Boost Dojo App.exe"
#define MyAppAssocName MyAppName + " File"
#define MyAppAssocExt ".myp"
#define MyAppAssocKey StringChange(MyAppAssocName, " ", "") + MyAppAssocExt

[Setup]
AppId={{A6936AEE-2E67-4ECC-807C-F2B57A77CD69}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
; Per-user install location - owned entirely by the current user, no admin
; needed to create, write, run, or delete anything inside it.
DefaultDirName={userpf}\{#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
ChangesAssociations=yes
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
; Never requests elevation. No UAC prompt will appear, and the installer
; cannot be forced to run as admin (no "Run as administrator" override).
PrivilegesRequired=lowest
SolidCompression=yes
WizardStyle=modern windows11
; Cloud compiling
OutputDir={#SourcePath}\installer
OutputBaseFilename=japaneseboostdojoapp-installer
SetupIconFile={#SourcePath}\icon.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"

[Tasks]
Name: "desktopicon"; \
    Description: "{cm:CreateDesktopIcon}"; \
    GroupDescription: "{cm:AdditionalIcons}"; \
    Flags: unchecked

[Files]
Source: "{#SourcePath}\Japanese Boost Dojo App-win32-x64\*"; \
    DestDir: "{app}"; \
    Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
; HKA automatically resolves to HKCU (not HKLM) when running unprivileged,
; so these writes never require admin rights either.
Root: HKA; \
    Subkey: "Software\Classes\{#MyAppAssocExt}\OpenWithProgids"; \
    ValueType: string; \
    ValueName: "{#MyAppAssocKey}"; \
    ValueData: ""; \
    Flags: uninsdeletevalue

Root: HKA; \
    Subkey: "Software\Classes\{#MyAppAssocKey}"; \
    ValueType: string; \
    ValueName: ""; \
    ValueData: "{#MyAppAssocName}"; \
    Flags: uninsdeletekey

Root: HKA; \
    Subkey: "Software\Classes\{#MyAppAssocKey}\DefaultIcon"; \
    ValueType: string; \
    ValueName: ""; \
    ValueData: "{app}\{#MyAppExeName},0"

Root: HKA; \
    Subkey: "Software\Classes\{#MyAppAssocKey}\shell\open\command"; \
    ValueType: string; \
    ValueName: ""; \
    ValueData: """{app}\{#MyAppExeName}"" ""%1"""

[Icons]
Name: "{group}\{#MyAppName}"; \
    Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; \
    Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; \
    Filename: "{app}\{#MyAppExeName}"; \
    Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; \
    Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; \
    Flags: nowait postinstall skipifsilent
