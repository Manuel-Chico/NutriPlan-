// ── ✅ CAMBIO 3: buscarAlimento — base propia (Neon) primero, FatSecret como respaldo ──
  const buscarAlimento = async (query) => {
    if (!query || query.length < 2) { setResultadosBusqueda([]); return; }
    setBuscando(true); setErrorBusqueda(null);
    try {
      // 1) Buscar primero en nuestra base propia de alimentos (Neon)
      const resPropia  = await fetch(`/api/alimentos?query=${encodeURIComponent(query)}&max_results=30`);
      const dataPropia = await resPropia.json();
      let resultados = resPropia.ok ? (dataPropia.resultados || []) : [];

      // 2) Si hay pocos resultados propios, complementamos con FatSecret
      //    (no reemplaza, solo agrega los que no estén ya cubiertos)
      if (resultados.length < 8) {
        try {
          const resFS  = await fetch(`/api/fatsecret?query=${encodeURIComponent(query)}&max_results=50`);
          const dataFS = await resFS.json();
          let resultadosFS = resFS.ok ? (dataFS.resultados || []) : [];

          // También probamos la traducción al inglés para mejorar cobertura en FatSecret
          const traduccion = traducirParaBusqueda(query);
          if (traduccion) {
            const resFS2  = await fetch(`/api/fatsecret?query=${encodeURIComponent(traduccion)}&max_results=50`);
            const dataFS2 = await resFS2.json();
            if (resFS2.ok && dataFS2.resultados?.length > 0) {
              const idsFS = new Set(resultadosFS.map(r => r.id));
              resultadosFS = [...resultadosFS, ...dataFS2.resultados.filter(r => !idsFS.has(r.id))];
            }
          }

          const conTraduccionFS = resultadosFS.map(f => ({
            ...f,
            nombre_es: traducirNombreResultado(f.nombre),
            _generico: esResultadoGenerico(f.nombre, traduccion),
            fuente_datos: "fatsecret",
          }));
          conTraduccionFS.sort((a, b) => (a._generico === b._generico ? 0 : a._generico ? -1 : 1));

          resultados = [...resultados, ...conTraduccionFS];
        } catch {
          // Si FatSecret falla, seguimos solo con lo que ya tengamos de la base propia
        }
      }

      if (resultados.length > 0) {
        setResultadosBusqueda(resultados.slice(0, 25));
      } else {
        setResultadosBusqueda([]);
        setErrorBusqueda("Sin resultados para esa búsqueda.");
      }
    } catch (err) {
      setErrorBusqueda(err.message || "Error al buscar. Intenta de nuevo.");
      setResultadosBusqueda([]);
    } finally {
      setBuscando(false);
    }
  };
