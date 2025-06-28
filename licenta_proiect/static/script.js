const SEMAFOR_COUNT = 5;

const TIMPI = {
    1: { ROSU: 60, GALBEN: 5, VERDE: 60 },
    2: { ROSU: 60, GALBEN: 5, VERDE: 60 },
    3: { ROSU: 60, GALBEN: 5, VERDE: 60 },
    4: { ROSU: 45, GALBEN: 5, VERDE: 45 },
    5: { ROSU: 45, GALBEN: 5, VERDE: 45 },
};

let semafoare = {};
let pietonActiv = {};
let semaforSelectat = 1;

function initSemafor(id) {
    return {
        id,
        stare: "ROSU",
        timpRamas: TIMPI[id].ROSU,
        pornit: true,
        noapte: false,
        timer: null
    };
}

function updateLEDuri(id) {
    const s = semafoare[id];
    const el = document.getElementById(`semafor${id}`);

    if (!s.pornit) {
        ["rosu", "galben", "verde"].forEach(c => {
            el.querySelector(`.led.${c}`).classList.remove("aprins");
        });
        el.querySelector(".timp").textContent = "OPRIT";
        return;
    }

    if (s.noapte) {
        ["rosu", "verde"].forEach(c => {
            el.querySelector(`.led.${c}`).classList.remove("aprins");
        });
        el.querySelector(".led.galben").classList.toggle("aprins");
        el.querySelector(".timp").textContent = "NOAPTE";
        return;
    }

    ["rosu", "galben", "verde"].forEach(c => {
        const led = el.querySelector(`.led.${c}`);
        led.classList.toggle("aprins", s.stare === c.toUpperCase());
    });

    el.querySelector(".timp").textContent = `${s.timpRamas}s`;
}

function urmatorEtapa(id) {
    const s = semafoare[id];
    if (s.noapte || !s.pornit) return;

    if (s.stare === "ROSU") {
        s.stare = "VERDE";
        s.timpRamas = TIMPI[id].VERDE;
        pietonActiv[id] = true;
    } else if (s.stare === "VERDE") {
        s.stare = "GALBEN";
        s.timpRamas = TIMPI[id].GALBEN;
    } else {
        s.stare = "ROSU";
        s.timpRamas = TIMPI[id].ROSU;
    }

    updateLEDuri(id);
    trimiteEveniment("Schimbare culoare", id);

    if (id === semaforSelectat) {
        fetch(`/api/select/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                stare: s.stare,
                timp: s.timpRamas,
                pornit: s.pornit,
                noapte: s.noapte
            })
        });
    }
}

function tick(id) {
    const s = semafoare[id];
    if (!s.pornit || s.noapte) return;

    if (s.stare === "VERDE" && s.timpRamas > 5 && pietonActiv[id]) {
        fetch("/api/pietoni")
            .then(res => res.json())
            .then(data => {
                const exista = data.some(ev => parseInt(ev.semafor) === id);
                if (exista) {
                    s.timpRamas = Math.max(s.timpRamas - 5, 1);
                    pietonActiv[id] = false;
                    updateLEDuri(id);

                    if (id === semaforSelectat) {
                        fetch(`/api/select/${id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                stare: s.stare,
                                timp: s.timpRamas,
                                pornit: s.pornit,
                                noapte: s.noapte
                            })
                        });
                    }
                }
            });
    }

    s.timpRamas--;

    if (s.timpRamas <= 0) {
        urmatorEtapa(id);
    } else {
        updateLEDuri(id);
    }
}

function pornesteSemafor(id) {
    const s = semafoare[id];
    if (!s.timer) {
        s.timer = setInterval(() => tick(id), 1000);
    }
}

function opresteSemafor(id) {
    const s = semafoare[id];
    if (s.timer) {
        clearInterval(s.timer);
        s.timer = null;
    }
}

function trimiteEveniment(tip, semafor, temperatura = null) {
    fetch("/api/eveniment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tip, semafor, temperatura })
    });
}

function setupButoane(id) {
    document.getElementById(`select${id}`).addEventListener("click", () => {
        const s = semafoare[id];
        semaforSelectat = id;
        trimiteEveniment("Selectare semafor", id);
        fetch(`/api/select/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                stare: s.stare,
                timp: s.timpRamas,
                pornit: s.pornit,
                noapte: s.noapte
            })
        });
    });

    document.getElementById(`noapte${id}`).addEventListener("click", () => {
        const s = semafoare[id];
        s.noapte = !s.noapte;
        updateLEDuri(id);
        fetch(`/api/noapte/${id}`, { method: "POST" });
        trimiteEveniment(s.noapte ? "Mod noapte ON" : "Mod noapte OFF", id);
    });

    document.getElementById(`opreste${id}`).addEventListener("click", () => {
        const s = semafoare[id];
        s.pornit = false;
        opresteSemafor(id);
        updateLEDuri(id);
        fetch(`/api/opreste/${id}`, { method: "POST" });
        trimiteEveniment("Oprire semafor", id);
    });

    document.getElementById(`porneste${id}`).addEventListener("click", () => {
        const s = semafoare[id];
        s.pornit = true;
        pornesteSemafor(id);
        updateLEDuri(id);
        fetch(`/api/porneste/${id}`, { method: "POST" });
        trimiteEveniment("Pornire semafor", id);
    });

    document.getElementById(`next${id}`).addEventListener("click", () => {
        urmatorEtapa(id);
    });
}

function init() {
    for (let i = 1; i <= SEMAFOR_COUNT; i++) {
        semafoare[i] = initSemafor(i);
        pietonActiv[i] = true;
        pornesteSemafor(i);
        setupButoane(i);
        updateLEDuri(i);
    }

    incarcaEvenimente();
    setInterval(incarcaEvenimente, 5000);
}

function incarcaEvenimente() {
    fetch("/api/evenimente")
        .then(res => res.json())
        .then(data => {
            const log = document.querySelector("#log");
            log.innerHTML = "";
            data.forEach(ev => {
                const item = document.createElement("li");
                item.textContent = `${ev.timestamp} - S${ev.semafor || "-"} - ${ev.tip}` +
                    (ev.temperatura !== null ? ` (${ev.temperatura}°C)` : "");
                log.appendChild(item);
            });
        });
}

function afiseazaTemperatura() {
    fetch("/api/temperatura", { method: "POST" });
    trimiteEveniment("Cerere temperatura");
}

document.addEventListener("DOMContentLoaded", init);
