import requests
from bs4 import BeautifulSoup
import json
import time
import os
import concurrent.futures
import threading
import datetime

# --- CONFIGURATION ---
FICHIER_ENTREE = 'dico2.txt'
FICHIER_SORTIE = 'resultats.json'
MAX_WORKERS = 50 # Parallélisme (attention aux blocages IP si trop élevé)

# Variables globales pour le suivi
resultats_globaux = []
mots_traites_session = 0
total_a_traiter = 0
start_time = 0
lock = threading.Lock() # Pour éviter que les threads se marchent dessus lors de l'affichage ou de la sauvegarde

def formater_temps(secondes):
    """Formate les secondes en HH:MM:SS"""
    return str(datetime.timedelta(seconds=int(secondes)))

def scraper_mot(mot):
    global mots_traites_session, start_time, resultats_globaux
    
    url = f"https://www.larousse.fr/dictionnaires/francais/{mot}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    description = "Description introuvable"
    definition = "Définition introuvable"
    statut = "OK"

    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')

            # 1. Extraction description
            catgram = soup.find('p', class_='CatgramDefinition')
            if catgram:
                description = catgram.get_text(strip=True)

            # 2. Extraction définition
            def_li = soup.find('li', class_='DivisionDefinition')
            if def_li:
                num_def = def_li.find('span', class_='numDef')
                if num_def:
                    num_def.extract() 
                for p in def_li.find_all('p'):
                    p.extract()
                definition = def_li.get_text(strip=True).lstrip('\xa0').lstrip()
        else:
            statut = f"Erreur {response.status_code}"
            description = statut
            definition = "Introuvable"

    except Exception as e:
        statut = "Erreur de connexion"
        description = statut
        definition = str(e)

    # Verrouillage pour mettre à jour les variables globales et l'affichage proprement
    with lock:
        mots_traites_session += 1
        
        # Ajout aux résultats
        resultats_globaux.append({
            "mot": mot,
            "description": description,
            "definition": definition
        })
        
        # Calcul de la progression et de l'ETA
        temps_ecoule = time.time() - start_time
        vitesse = temps_ecoule / mots_traites_session # secondes par mot
        mots_restants = total_a_traiter - mots_traites_session
        eta_secondes = vitesse * mots_restants
        
        pourcentage = (mots_traites_session / total_a_traiter) * 100
        
        # Affichage
        print(f"[{mots_traites_session}/{total_a_traiter} - {pourcentage:.1f}%] (ETA: {formater_temps(eta_secondes)})")
        if statut == "OK":
            print(f"✓ Mot : {mot}")
            print(f"  Desc : {description}")
            print(f"  Def  : {definition[:100]}..." if len(definition) > 100 else f"  Def  : {definition}")
        else:
            print(f"✗ Mot : {mot} -> {statut}")
        print("-" * 50)
        
        # Sauvegarde régulière (optionnelle mais sécuritaire en cas de crash)
        if mots_traites_session % 50 == 0:
            with open(FICHIER_SORTIE, 'w', encoding='utf-8') as f:
                json.dump(resultats_globaux, f, ensure_ascii=False, indent=4)

def main():
    global resultats_globaux, total_a_traiter, start_time

    if not os.path.exists(FICHIER_ENTREE):
        print(f"❌ Erreur : Le fichier '{FICHIER_ENTREE}' est introuvable.")
        return

    # 1. Charger les mots déjà traités pour reprendre là où on s'est arrêté
    mots_deja_faits = set()
    if os.path.exists(FICHIER_SORTIE):
        try:
            with open(FICHIER_SORTIE, 'r', encoding='utf-8') as f:
                resultats_globaux = json.load(f)
                mots_deja_faits = {item['mot'] for item in resultats_globaux}
            print(f"📁 Fichier JSON trouvé. {len(mots_deja_faits)} mots déjà traités ont été chargés.")
        except json.JSONDecodeError:
            print("⚠️ Le fichier JSON existant est corrompu. Démarrage de zéro.")
            resultats_globaux = []

    # 2. Lire le dictionnaire et filtrer
    with open(FICHIER_ENTREE, 'r', encoding='utf-8') as f:
        tous_les_mots = [ligne.strip() for ligne in f if ligne.strip()]

    mots_a_traiter = [mot for mot in tous_les_mots if mot not in mots_deja_faits]
    total_a_traiter = len(mots_a_traiter)

    if total_a_traiter == 0:
        print("✅ Tous les mots du dictionnaire ont déjà été traités !")
        return

    print(f"🚀 Lancement du scraping pour {total_a_traiter} mot(s) restant(s) avec {MAX_WORKERS} workers...\n")
    print("=" * 50)

    start_time = time.time()

    # 3. Lancement des threads en parallèle
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            executor.map(scraper_mot, mots_a_traiter)
    except KeyboardInterrupt:
        print("\n🛑 Interruption par l'utilisateur. Sauvegarde en cours...")

    # 4. Sauvegarde finale
    with open(FICHIER_SORTIE, 'w', encoding='utf-8') as f:
        json.dump(resultats_globaux, f, ensure_ascii=False, indent=4)
    
    temps_total = formater_temps(time.time() - start_time)
    print(f"\n✅ Terminé ! Scraping fini en {temps_total}. Résultats enregistrés dans '{FICHIER_SORTIE}'.")

if __name__ == "__main__":
    main()