import requests
from bs4 import BeautifulSoup
import time

# Nom du fichier où les mots seront sauvegardés
fichier_sortie = "mots_extraits.txt"
nombre_total_pages = 1548

def extraire_mots_de_la_page(url):
    """Télécharge la page et extrait les mots contenus dans <span class="mt">"""
    try:
        # On fait la requête HTTP
        reponse = requests.get(url, timeout=10)
        reponse.raise_for_status()  # Vérifie s'il y a une erreur HTTP
        
        # On analyse le HTML
        soup = BeautifulSoup(reponse.text, 'html.parser')
        
        # On cherche la balise span avec la classe 'mt'
        span_mots = soup.find('span', class_='mt')
        
        if span_mots:
            # On récupère le texte et on le divise en une liste de mots (séparés par les espaces)
            mots = span_mots.get_text().split()
            return mots
        else:
            print(f"Aucun mot trouvé sur {url}")
            return []
            
    except requests.RequestException as e:
        print(f"Erreur lors de la connexion à {url} : {e}")
        return []

# Ouverture du fichier en mode écriture ("w")
with open(fichier_sortie, "w", encoding="utf-8") as fichier:
    
    for page in range(1, nombre_total_pages + 1):
        # Construction de l'URL selon le numéro de la page
        if page == 1:
            url = "https://www.listesdemots.net/touslesmots.htm"
        else:
            url = f"https://www.listesdemots.net/touslesmotspage{page}.htm"
            
        print(f"Extraction de la page {page}/{nombre_total_pages}...")
        
        # Récupération des mots
        liste_mots = extraire_mots_de_la_page(url)
        
        # Écriture des mots dans le fichier texte (un mot par ligne)
        if liste_mots:
            for mot in liste_mots:
                fichier.write(mot + "\n")
                
        # Pause de 0.5 seconde pour être courtois avec le serveur hébergeant le site
        time.sleep(0.5)

print(f"\nTerminé ! Tous les mots ont été sauvegardés dans le fichier '{fichier_sortie}'.")