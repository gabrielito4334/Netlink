const nodos = new vis.DataSet([]);
const aristas = new vis.DataSet([]);
const container = document.getElementById("network");

const networkData = { nodes: nodos, edges: aristas };

// configuraciones del grafo
const options = {
    physics: {
        enabled: false   
    },
    layout: {
        improvedLayout: true
    },
    edges: { 
        smooth: false, 
        font: { align: "middle" } 
    },
    nodes: { 
        shape: "dot", 
        size: 15,            
        font: { size: 14 }   
    }
};

const red = new vis.Network(container, networkData, options);

// Actualiza las selecciones de nodos en los selects
function actualizarSelects() {
    const s1 = document.getElementById("source");
    const s2 = document.getElementById("target");
    s1.innerHTML = "";
    s2.innerHTML = "";
    const nodes = nodos.get();

    nodes.forEach(n => {
        const o1 = document.createElement("option");
        o1.value = n.id;
        o1.textContent = n.label || `Nodo ${n.id}`;
        s1.appendChild(o1);

        const o2 = document.createElement("option");
        o2.value = n.id;
        o2.textContent = n.label || `Nodo ${n.id}`;
        s2.appendChild(o2);
    });
}

// Cargar grafo real en base al dataset
async function cargarGrafoReal() {
    try {
        const resp = await fetch("/grafo-real");
        const data = await resp.json();

        if (!data || data.status !== "ok") {
            alert("Error al cargar el dataset: " + (data && data.message ? data.message : ""));
            return;
        }

        nodos.clear();
        aristas.clear();

        // Añade nodos
        data.nodos.forEach(n => {
            const item = { id: n.id, label: n.label };
            if (typeof n.x !== "undefined" && typeof n.y !== "undefined") {
                item.x = n.x;
                item.y = n.y;
                item.fixed = { x: false, y: false };
            }
            nodos.add(item);
        });

        // Añade aristas
        data.aristas.forEach(e => {
            aristas.add({
                id: `${e.from}-${e.to}`,
                from: e.from,
                to: e.to,
                label: `${e.latency} ms`,
                latency: e.latency,
                capacity: e.capacity,
                color: "gray",
                width: 1
            });
        });

        actualizarSelects();
        red.fit({ animation: { duration: 600 } });

        document.getElementById("result").textContent =
            `Grafo cargado:\n- Nodos: ${data.nodos.length}\n- Aristas: ${data.aristas.length}`;

    } catch (err) {
        console.error(err);
        alert("No se pudo leer el dataset desde el servidor.");
    }
}

document.getElementById("btn-cargar-real").addEventListener("click", cargarGrafoReal);

// Limpia estilos de aristas y nodos
function limpiarEstilos() {
    const edges = aristas.get().map(e => ({ id: e.id, color: "gray", width: 1 }));
    aristas.update(edges);

    const nodes = nodos.get().map(n => ({ id: n.id, color: undefined }));
    nodos.update(nodes);
}

// Ejecuta cada tipo de algoritmo mediante los endpoints
async function ejecutarAlgoritmo(nombre, payload = {}) {
    try {
        limpiarEstilos();
        document.getElementById("result").textContent = "Ejecutando algoritmo...";

        const resp = await fetch(`/alg/${nombre}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await resp.json();
        document.getElementById("result").textContent = JSON.stringify(data, null, 2);

        // Encontrar camino mas corto(Dijkstra, Bellman, Floyd)
        if (data.camino && Array.isArray(data.camino)) {
            const caminoNodos = data.camino;

            caminoNodos.forEach(id => {
                nodos.update({ id: parseInt(id), color: { background: '#FFA500', border: '#FF8C00' } });
            });

            for (let i = 0; i < caminoNodos.length - 1; i++) {
                const a = parseInt(caminoNodos[i]);
                const b = parseInt(caminoNodos[i + 1]);
                const edgeId1 = `${a}-${b}`;
                const edgeId2 = `${b}-${a}`;

                if (aristas.get(edgeId1)) {
                    aristas.update({ id: edgeId1, color: 'red', width: 3 });
                } else if (aristas.get(edgeId2)) {
                    aristas.update({ id: edgeId2, color: 'red', width: 3 });
                }
            }

            red.fit({ animation: { duration: 600 } });
        }

        // MST (Prim, Kruskal)
        if (data.mst && Array.isArray(data.mst)) {
            data.mst.forEach(e => {
                const edgeId1 = `${e.from}-${e.to}`;
                const edgeId2 = `${e.to}-${e.from}`;

                if (aristas.get(edgeId1)) {
                    aristas.update({ id: edgeId1, color: 'green', width: 3 });
                } else if (aristas.get(edgeId2)) {
                    aristas.update({ id: edgeId2, color: 'green', width: 3 });
                }
            });

            red.fit({ animation: { duration: 600 } });
        }

        // Ford-Fulkerson (flujo maximo)
        if (typeof data.flujo_maximo !== "undefined") {
            if (data.detalle) {
                Object.keys(data.detalle).forEach(u => {
                    Object.keys(data.detalle[u]).forEach(v => {
                        const f = data.detalle[u][v];
                        const edgeId = `${u}-${v}`;
                        if (aristas.get(edgeId)) {
                            const width = 2 + Math.min(6, f);
                            aristas.update({ id: edgeId, color: 'blue', width });
                        }
                    });
                });
            }

            red.fit({ animation: { duration: 600 } });
        }

    } catch (err) {
        console.error(err);
        document.getElementById("result").textContent = `Error: ${err.message || err}`;
    }
}

// Botones de ejecución de los algoritmos
document.getElementById("run-dijkstra").addEventListener("click", () => {
    const s = document.getElementById("source").value;
    const t = document.getElementById("target").value;
    if (!s || !t) { alert("Selecciona origen y destino."); return; }
    ejecutarAlgoritmo("dijkstra", { source: String(s), target: String(t) });
});

document.getElementById("run-bellman").addEventListener("click", () => {
    const s = document.getElementById("source").value;
    if (!s) { alert("Selecciona origen."); return; }
    ejecutarAlgoritmo("bellman_ford", { source: String(s) });
});

document.getElementById("run-floyd").addEventListener("click", () => {
    const s = document.getElementById("source").value;
    const t = document.getElementById("target").value;
    ejecutarAlgoritmo("floyd_warshall", { source: s ? String(s) : null, target: t ? String(t) : null });
});

document.getElementById("run-prim").addEventListener("click", () => {
    ejecutarAlgoritmo("prim", {});
});

document.getElementById("run-kruskal").addEventListener("click", () => {
    ejecutarAlgoritmo("kruskal", {});
});

document.getElementById("run-ff").addEventListener("click", () => {
    const s = document.getElementById("source").value;
    const t = document.getElementById("target").value;
    if (!s || !t) { alert("Selecciona origen y destino."); return; }
    ejecutarAlgoritmo("ford_fulkerson", { source: String(s), target: String(t) });
});