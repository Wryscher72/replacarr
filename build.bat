@echo off
setlocal

cd /d "%~dp0"

echo.
echo  ================================================
echo   Replacarr Build
echo  ================================================
echo.
echo  Choose build output:
echo    1  Installer folder  (electron:build)
echo    2  Zip archive       (electron:build:zip)
echo    3  Type check only   (tsc --noEmit)
echo    4  Exit
echo.
set /p CHOICE= Enter choice [1-4]: 

if "%CHOICE%"=="1" goto BUILD
if "%CHOICE%"=="2" goto BUILD_ZIP
if "%CHOICE%"=="3" goto TYPECHECK
if "%CHOICE%"=="4" goto END

echo  Invalid choice.
goto END

:TYPECHECK
echo.
echo  Running TypeScript check...
call npx tsc --noEmit
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [FAIL] Type errors found. Fix them before building.
) else (
    echo  [OK] No type errors.
)
goto END

:BUILD
echo.
echo  Running type check before build...
call npx tsc --noEmit
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [FAIL] Type errors found. Fix them before building.
    goto END
)
echo  [OK] Type check passed.
echo.
echo  Building installer folder...
call npm run electron:build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [FAIL] Build failed.
) else (
    echo.
    echo  [OK] Build complete. Output in: dist-installer\win-unpacked\
)
goto END

:BUILD_ZIP
echo.
echo  Running type check before build...
call npx tsc --noEmit
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [FAIL] Type errors found. Fix them before building.
    goto END
)
echo  [OK] Type check passed.
echo.
echo  Building zip archive...
call npm run electron:build:zip
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [FAIL] Build failed.
) else (
    echo.
    echo  [OK] Build complete. Output in: dist-installer\Replacarr-win-x64.zip
)
goto END

:END
echo.
pause
