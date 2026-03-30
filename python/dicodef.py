import ollama
import json
import os
from tqdm import tqdm

# --- CONFIGURATION ---
INPUT_FILE = "dico.txt"
OUTPUT_FILE = "dico_scrabble.json"
MODEL = "mistral"
SAVE_INTERVAL = 100

def load_progress():
    """Charge les données existantes sous forme de liste."""
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="latin-1") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                print("Le fichier JSON existant est corrompu, on repart de zéro.")
                return []
    return []

def main():
    donnees_json = load_progress()
    mots_deja_faits = {item["mot"] for item in donnees_json}

    if not os.path.exists(INPUT_FILE):
        print(f"Erreur : Le fichier {INPUT_FILE} est introuvable.")
        return

    # Retour à l'encodage utf-8 pour la lecture du dictionnaire
    with open(INPUT_FILE, "r", encoding="latin-1") as f:
        tous_les_mots = [line.strip() for line in f if line.strip()]

    mots_a_traiter = [mot for mot in tous_les_mots if mot not in mots_deja_faits]

    print(f"Total de mots dans {INPUT_FILE} : {len(tous_les_mots)}")
    print(f"Mots déjà traités : {len(mots_deja_faits)}")
    print(f"Mots restants à générer : {len(mots_a_traiter)}\n")

    if not mots_a_traiter:
        print("Tous les mots ont déjà été traités !")
        return

    for i, mot in enumerate(tqdm(mots_a_traiter, desc="Génération")):
        
        system_prompt = (
            "Tu es un dictionnaire de Scrabble très concis. "
            "Donne une définition claire en 1 ou 2 lignes maximum. "
            "Ne donne QUE la définition. Ne commence pas par 'Ce mot signifie' ou 'C'est un'. "
            "Sois direct."
        )

        try:
            response = ollama.chat(model=MODEL, messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": mot}
            ], options={
                "num_predict": 60,  # SECURITE : Force l'IA à s'arrêter après environ 40-60 mots !
                "temperature": 0.1  # Rend l'IA factuelle et très peu bavarde
            })
            
            definition = response['message']['content'].strip(' "\'\n')
            
            donnees_json.append({
                "mot": mot,
                "definition": definition
            })

            # Affichage en direct du mot et de sa définition trouvée !
            # On utilise tqdm.write pour ne pas casser la barre de progression
            tqdm.write(f"{mot} : {definition} trouvé !")

        except Exception as e:
            tqdm.write(f"\nErreur lors du traitement du mot '{mot}' : {e}")
            continue

        if (i + 1) % SAVE_INTERVAL == 0:
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(donnees_json, f, ensure_ascii=False, indent=4)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(donnees_json, f, ensure_ascii=False, indent=4)
        
    print("\nGénération terminée avec succès !")

if __name__ == "__main__":
    main()