@echo off
:: Permet d'afficher correctement les accents dans la console Windows
chcp 65001 >nul
color 0A

echo ========================================================
echo     INSTALLATION DE L'ENVIRONNEMENT - DICO SCRABBLE
echo ========================================================
echo.

:: 1. Vérification de Python
echo [1/4] Verification de Python...
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERREUR] Python n'est pas installe ou n'est pas ajoute au "PATH" de Windows.
    echo Veuillez installer Python depuis le Microsoft Store ou python.org en cochant "Add Python to PATH".
    echo.
    pause
    exit /b
) ELSE (
    echo Python est bien installe !
)
echo.

:: 2. Installation des bibliothèques Python
echo [2/4] Installation des bibliotheques Python (ollama, tqdm)...
pip install ollama tqdm
echo.

:: 3. Vérification de Ollama
echo [3/4] Verification de Ollama...
ollama --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    color 0E
    echo [AVERTISSEMENT] Ollama ne semble pas installe ou n'est pas actif.
    echo.
    echo Si vous ne l'avez pas encore installe, allez sur : https://ollama.com/download
    echo Si vous venez de l'installer, assurez-vous qu'il est lance (l'icone doit etre dans la barre des taches).
    echo.
    pause
    exit /b
) ELSE (
    echo Ollama est bien installe et detecte !
)
echo.

:: 4. Téléchargement du modèle Mistral
echo [4/4] Telechargement du modele Mistral (cela peut prendre quelques minutes)...
echo Assurez-vous d'avoir une bonne connexion internet.
ollama pull mistral
echo.

echo ========================================================
color 0A
echo [SUCCES] L'installation est terminee !
echo Votre environnement est pret. Vous pouvez maintenant lancer votre script Python.
echo ========================================================
echo.
pause