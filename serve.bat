@echo off
echo ========================================
echo   Scrabble - Serveur local
echo   http://localhost:8080
echo ========================================
echo.
echo Ouvrez votre navigateur sur http://localhost:8080
echo Appuyez sur Ctrl+C pour arreter le serveur.
echo.
python -m http.server 8080
pause
