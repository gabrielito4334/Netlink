from flask import Flask, render_template, request, jsonify
import networkx as nx
import pandas as pd
import random

app = Flask(__name__)

DATASET_FILE = "dataset_red.xlsx"  

# Función para cargar dataset desde archivo Excel 
def cargar_dataset():
    try:
        df_nodes = pd.read_excel(DATASET_FILE, sheet_name="nodes")
        df_edges = pd.read_excel(DATASET_FILE, sheet_name="edges")

        nodos = [
            {
                "id": int(row["id"]),
                "label": str(row["name"]),
                "x": float(row["x"]) if not pd.isna(row["x"]) else None,
                "y": float(row["y"]) if not pd.isna(row["y"]) else None
            }
            for _, row in df_nodes.iterrows()
        ]

        aristas = [
            {
                "from": int(row["from"]),
                "to": int(row["to"]),
                "latency": float(row["latency"]),
                "capacity": float(row["capacity"])
            }
            for _, row in df_edges.iterrows()
        ]

        return nodos, aristas

    except Exception as e:
        print("Error cargando dataset:", e)
        return [], []

@app.route('/grafo-real')
def grafo_real():
    try:
        nodos, aristas = cargar_dataset()

        # Se limita la cantidad de nodos para no sobrecargar el navegador
        MAX_VISUAL = 200
        if len(nodos) > MAX_VISUAL:
            nodos_sample = random.sample(nodos, MAX_VISUAL)
            ids_permitidos = {n["id"] for n in nodos_sample}
            aristas_sample = [a for a in aristas if a["from"] in ids_permitidos and a["to"] in ids_permitidos]
        else:
            nodos_sample = nodos
            aristas_sample = aristas

        return jsonify({"status": "ok", "nodos": nodos_sample, "aristas": aristas_sample})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/')
def index():
    return render_template('index.html')

# endpoint para todas las tecnicas empleadas 
@app.route('/alg/<nombre>', methods=['POST'])
def alg_handler(nombre):
    try:
        payload = request.get_json() or {}
        source = payload.get("source")
        target = payload.get("target")

        nodos, aristas = cargar_dataset()

        G = nx.DiGraph()
        for n in nodos:
            G.add_node(str(n["id"]))

        for e in aristas:
            G.add_edge(str(e["from"]), str(e["to"]), weight=float(e["latency"]), capacity=float(e["capacity"]))

        result = {}

        if nombre == "dijkstra":
            if not source or not target:
                return jsonify({"error": "source and target required"}), 400
            try:
                camino = nx.shortest_path(G, str(source), str(target), weight="weight")
                distancia = nx.shortest_path_length(G, str(source), str(target), weight="weight")
                result["camino"] = camino
                result["distancia"] = distancia
            except nx.NetworkXNoPath:
                result["error"] = "No existe camino."

        elif nombre == "prim":
            T = nx.minimum_spanning_tree(G.to_undirected())
            result["mst"] = [{"from": u, "to": v, "weight": d["weight"]} for u, v, d in T.edges(data=True)]
            result["peso_total"] = sum(d["weight"] for u, v, d in T.edges(data=True))

        elif nombre == "kruskal":
            T = nx.minimum_spanning_tree(G.to_undirected(), algorithm="kruskal")
            result["mst"] = [{"from": u, "to": v, "weight": d["weight"]} for u, v, d in T.edges(data=True)]
            result["peso_total"] = sum(d["weight"] for u, v, d in T.edges(data=True))

        elif nombre == "ford_fulkerson":
            if not source or not target:
                return jsonify({"error": "source and target required"}), 400
            try:
                flujo, detalle = nx.maximum_flow(G, str(source), str(target), capacity="capacity")
                result["flujo_maximo"] = flujo
                result["detalle"] = detalle
            except nx.NetworkXError as e:
                result["error"] = str(e)

        elif nombre == "floyd_warshall":
            try:
                distancias = dict(nx.floyd_warshall(G, weight="weight"))
            
                if source and target and str(source) in distancias and str(target) in distancias[str(source)]:
                    camino = nx.shortest_path(G, str(source), str(target), weight="weight")
                    result["camino"] = camino
                    result["distancia"] = distancias[str(source)][str(target)]
                else:
                
                    muestra = {}
                    keys = list(distancias.keys())[:10]
                    for s in keys:
                        muestra[s] = {t: distancias[s][t] for t in list(distancias[s].keys())[:10]}
                    result["distancias_muestra"] = muestra
                    result["nota"] = "Se muestra una muestra 10x10. Floyd-Warshall calculó todas las distancias."
                result["total_nodos"] = len(distancias)
            except Exception as e:
                result["error"] = str(e)

        elif nombre == "bellman_ford":
            if not source:
                return jsonify({"error": "source required"}), 400
            try:
                distancias, caminos = nx.single_source_bellman_ford(G, str(source), weight="weight")
                if target and str(target) in distancias:
                    result["camino"] = caminos[str(target)]
                    result["distancia"] = distancias[str(target)]
                else:
                    sample = list(distancias.keys())[:10]
                    result["distancias_muestra"] = {k: distancias[k] for k in sample}
                result["nodos_alcanzables"] = len(distancias)
            except Exception as e:
                result["error"] = str(e)

        else:
            result["error"] = f"Algoritmo {nombre} no soportado."

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)