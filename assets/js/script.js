// SportsHub — Logica dell'applicazione

// Endpoint dell'API pubblica di test
const API_BASE_URL = "https://www.thesportsdb.com/api/v1/json/3";


// === Classi ===

// Modello per mappare i dati della squadra presi dalla API

class Squadra {
  constructor(data) {
    this.id = data.idTeam;
    this.nome = data.strTeam;
    // Se la squadra non ha un logo nel database, usiamo un'immagine grigia di default (Placeholder).
    this.badge = data.strBadge || data.strTeamBadge || data.strTeamLogo || "https://via.placeholder.com/90x90.png?text=No+Logo";
    this.campionato = data.strLeague || "Campionato non specificato";
    this.paese = data.strCountry || "Nazione sconosciuta";
  }
}

// Modello per mappare gli eventi della squadra

class Evento {
  constructor(data) {
    this.nomeEvento = data.strEvent;
    this.dataEvento = data.dateEvent;
    this.punteggioHome = data.intHomeScore;
    this.punteggioAway = data.intAwayScore;
  }
}


// === Stato dell'app ===


const StatoApp = {
  preferiti: JSON.parse(localStorage.getItem("sportshub_preferiti")) || [],
  salvaPreferiti() {
    localStorage.setItem("sportshub_preferiti", JSON.stringify(this.preferiti));
  }
};
StatoApp.preferiti = StatoApp.preferiti.filter(p => p.badge && !p.badge.includes("undefined"));
StatoApp.salvaPreferiti();


// === Funzioni API ===


async function cercaSquadre(query) {
  try {
    const response = await fetch(`${API_BASE_URL}/searchteams.php?t=${query}`);
    if (!response.ok) throw new Error("Problema di connessione.");
    
    const data = await response.json();
    if (!data.teams) return []; 

    return data.teams.map(teamData => new Squadra(teamData));
  } catch (error) {
    console.error("Errore nella ricerca:", error);
    throw error;
  }
}

async function caricaDettagli(idTeam) {
  try {
    const urlProssimi = `${API_BASE_URL}/eventsnext.php?id=${idTeam}`;
    const urlUltimi = `${API_BASE_URL}/eventslast.php?id=${idTeam}`;

    const [resProssimi, resUltimi] = await Promise.all([
      fetch(urlProssimi),
      fetch(urlUltimi)
    ]);

    const dataProssimi = await resProssimi.json();
    const dataUltimi = await resUltimi.json();

    const prossimiEventi = (dataProssimi.events || []).map(ev => new Evento(ev));
    const ultimiRisultati = (dataUltimi.results || dataUltimi.events || []).map(ev => new Evento(ev));

    return { prossimiEventi, ultimiRisultati };
  } catch (error) {
    console.error("Errore nel caricamento dei dettagli:", error);
    throw error;
  }
}


// Funzioni Rendering ===


function formattaData(dataStr) {
  if (!dataStr) return "";
  const parti = dataStr.split("-");
  return parti.length === 3 ? `${parti[2]}/${parti[1]}/${parti[0]}` : dataStr;
}

function renderPreferiti() {
  const container = document.getElementById("preferiti-container");
  container.innerHTML = "";

  if (StatoApp.preferiti.length === 0) {
    container.innerHTML = `<p class="loading-spinner">Nessuna squadra tra i preferiti. Aggiungine una!</p>`;
    return;
  }

  StatoApp.preferiti.forEach(squadra => {
    const card = document.createElement("div");
    card.className = "team-card";
    
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-rimuovi")) return; 
      mostraDettagliSquadra(squadra);
    });

    card.innerHTML = `
      <img src="${squadra.badge}" alt="Logo ${squadra.nome}">
      <h3>${squadra.nome}</h3>
      <p class="league">${squadra.campionato}</p>
      <p class="country">${squadra.paese}</p>
      <button class="btn-rimuovi">🗑️ Rimuovi</button>
    `;

    card.querySelector(".btn-rimuovi").addEventListener("click", () => {
      rimuoviDaiPreferiti(squadra.id);
    });

    container.appendChild(card);
  });
}

function renderRisultati(squadre) {
  const container = document.getElementById("risultati-container");
  container.innerHTML = "";

  if (squadre.length === 0) {
    container.innerHTML = `<p class="error-message">Nessuna corrispondenza trovata.</p>`;
    return;
  }

  const squadra = squadre[0]; 
  const giaPreferito = StatoApp.preferiti.some(p => p.id === squadra.id);

  const card = document.createElement("div");
  card.className = "team-card";
  
  card.addEventListener("click", (e) => {
    if (e.target.closest(".btn-aggiungi")) return;
    mostraDettagliSquadra(squadra);
  });

  card.innerHTML = `
    <img src="${squadra.badge}" alt="Logo ${squadra.nome}">
    <h3>${squadra.nome}</h3>
    <p class="league">${squadra.campionato}</p>
    <p class="country">${squadra.paese}</p>
    ${!giaPreferito ? `<button class="btn-aggiungi">Aggiungi ai preferiti</button>` : `<p style="color: #22c55e; font-weight: bold; margin-top: 12px;">★ Già nei preferiti</p>`}
  `;

  if (!giaPreferito) {
    card.querySelector(".btn-aggiungi").addEventListener("click", () => {
      aggiungiAiPreferiti(squadra);
    });
  }

  container.appendChild(card);
  
  mostraDettagliSquadra(squadra);
}

async function mostraDettagliSquadra(squadra) {
  const dettagliSection = document.getElementById("dettagli-section");
  dettagliSection.removeAttribute("hidden");
  dettagliSection.innerHTML = `<p class="loading-spinner">Caricamento in corso per ${squadra.nome}...</p>`;

  try {
    const { prossimiEventi, ultimiRisultati } = await caricaDettagli(squadra.id);
    
    let prossimiHTML = "";
    if (prossimiEventi.length === 0) {
      prossimiHTML = `<p class="no-events">Nessun evento in programma</p>`;
    } else {
      prossimiEventi.forEach(ev => {
        prossimiHTML += `
          <div class="event-item">
            <span class="event-date">${formattaData(ev.dataEvento)}</span>
            <span>${ev.nomeEvento}</span>
          </div>
        `;
      });
    }

    let ultimiHTML = "";
    if (ultimiRisultati.length === 0) {
      ultimiHTML = `<p class="no-events">Nessun risultato recente</p>`;
    } else {
      ultimiRisultati.slice(0, 5).forEach(ev => {
        const haPunteggio = ev.punteggioHome !== null && ev.punteggioAway !== null;
        ultimiHTML += `
          <div class="event-item">
            <span class="event-date">${formattaData(ev.dataEvento)}</span>
            <div class="event-row">
              <span>${ev.nomeEvento}</span>
              ${haPunteggio ? `<span class="score-badge">${ev.punteggioHome} - ${ev.punteggioAway}</span>` : ""}
            </div>
          </div>
        `;
      });
    }

    dettagliSection.innerHTML = `
      <h2>${squadra.nome}</h2>
      <div class="details-grid">
        <div class="event-column">
          <h3>Prossimi eventi</h3>
          ${prossimiHTML}
        </div>
        <div class="event-column">
          <h3>Ultimi risultati</h3>
          ${ultimiHTML}
        </div>
      </div>
    `;

  } catch (error) {
    dettagliSection.innerHTML = `<p class="error-message">Errore nel recupero degli eventi.</p>`;
  }
}


// === Eventi (Listeners) ===


function aggiungiAiPreferiti(squadra) {
  if (!StatoApp.preferiti.some(p => p.id === squadra.id)) {
    StatoApp.preferiti.push(squadra);
    StatoApp.salvaPreferiti();
    renderPreferiti();
    
    const btn = document.querySelector(".btn-aggiungi");
    if (btn) {
      const p = document.createElement("p");
      p.style.color = "#22c55e";
      p.style.fontWeight = "bold";
      p.style.marginTop = "12px";
      p.innerText = "★ Già nei preferiti";
      btn.replaceWith(p);
    }
  }
}

function rimuoviDaiPreferiti(idTeam) {
  StatoApp.preferiti = StatoApp.preferiti.filter(p => p.id !== idTeam);
  StatoApp.salvaPreferiti();
  renderPreferiti();
  
  document.getElementById("dettagli-section").setAttribute("hidden", "true");
}

document.getElementById("search-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const input = document.getElementById("search-input");
  const query = input.value.trim();
  
  if (!query) return;

  const risultatiContainer = document.getElementById("risultati-container");
  risultatiContainer.innerHTML = `<p class="loading-spinner">Ricerca nel database in corso...</p>`;
  
  try {
    const squadreTrovate = await cercaSquadre(query);
    renderRisultati(squadreTrovate);
  } catch (error) {
    risultatiContainer.innerHTML = `<p class="error-message">Errore di rete. Controlla la tua connessione.</p>`;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  renderPreferiti();
});