// js/barcode.js - Modulo de Generacion de Codigos de Barras
// Dependencia: Biblioteca JsBarcode (CDN) y Supabase

const BarcodeModule = (() => {
    // Configuracion privada
    const _config = {
        defaultBarcodeFormat: 'CODE128',
        defaultWidth: 2,
        defaultHeight: 80,
        defaultFontSize: 14,
        defaultMargin: 10,
        displayValue: true
    };

    // Variable para almacenar la ventana de impresion
    let printWindow = null;

    /**
     * Inicializa el modulo de codigos de barras
     * Se llama cuando la vista de inventario esta activa
     */
    function init() {
        _addBarcodeStyles();
        _waitForInventoryView();
    }

    /**
     * Espera a que la vista de inventario se renderice para agregar el boton
     */
    function _waitForInventoryView() {
        const observer = new MutationObserver(() => {
            const inventarioContainer = document.querySelector('#inventario-container, .inventario-view, [data-view="inventario"], #main-content');
            const existingButton = document.getElementById('btn-open-barcode');
            
            if (inventarioContainer && !existingButton) {
                _addBarcodeButton(inventarioContainer);
            }
        });

        observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: true 
        });

        // Tambien verificar inmediatamente
        setTimeout(() => {
            const inventarioContainer = document.querySelector('#inventario-container, .inventario-view, [data-view="inventario"], #main-content');
            const existingButton = document.getElementById('btn-open-barcode');
            if (inventarioContainer && !existingButton) {
                _addBarcodeButton(inventarioContainer);
            }
        }, 500);
    }

    /**
     * Agrega los estilos CSS necesarios para la interfaz de codigos de barras
     */
    function _addBarcodeStyles() {
        const styleId = 'barcode-module-styles';
        if (document.getElementById(styleId)) return;

        const styles = `
            /* Estilos del Modal de Codigos de Barras */
            .barcode-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.6);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                backdrop-filter: blur(3px);
            }

            .barcode-modal {
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                width: 90%;
                max-width: 900px;
                max-height: 85vh;
                overflow-y: auto;
                padding: 0;
            }

            .barcode-modal-header {
                background: linear-gradient(135deg, #1a3a6b, #2c5aa0);
                color: white;
                padding: 20px 25px;
                border-radius: 12px 12px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 3px solid #c41e3a;
            }

            .barcode-modal-header h2 {
                margin: 0;
                font-size: 1.3em;
                font-weight: 600;
                letter-spacing: 0.5px;
            }

            .barcode-modal-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                font-size: 1.5em;
                cursor: pointer;
                width: 35px;
                height: 35px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }

            .barcode-modal-close:hover {
                background: rgba(255, 255, 255, 0.4);
                transform: rotate(90deg);
            }

            .barcode-modal-body {
                padding: 25px;
            }

            /* Filtros */
            .barcode-filters {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 25px;
                border: 1px solid #e0e0e0;
            }

            .barcode-filters h3 {
                margin: 0 0 15px 0;
                color: #1a3a6b;
                font-size: 1.1em;
                font-weight: 600;
            }

            .barcode-filter-group {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
                align-items: flex-end;
            }

            .barcode-filter-item {
                flex: 1;
                min-width: 200px;
            }

            .barcode-filter-item label {
                display: block;
                margin-bottom: 5px;
                color: #555;
                font-size: 0.9em;
                font-weight: 500;
            }

            .barcode-filter-item select,
            .barcode-filter-item input {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid #ced4da;
                border-radius: 6px;
                font-size: 0.95em;
                transition: border-color 0.3s ease;
                box-sizing: border-box;
            }

            .barcode-filter-item select:focus,
            .barcode-filter-item input:focus {
                outline: none;
                border-color: #2c5aa0;
                box-shadow: 0 0 0 3px rgba(44, 90, 160, 0.1);
            }

            .barcode-filter-actions {
                display: flex;
                gap: 10px;
                align-items: flex-end;
            }

            .btn-barcode-generate {
                background: linear-gradient(135deg, #c41e3a, #a01830);
                color: white;
                border: none;
                padding: 12px 25px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.95em;
                font-weight: 600;
                transition: all 0.3s ease;
                white-space: nowrap;
            }

            .btn-barcode-generate:hover {
                background: linear-gradient(135deg, #a01830, #8b1529);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(196, 30, 58, 0.3);
            }

            .btn-barcode-print {
                background: linear-gradient(135deg, #1a3a6b, #2c5aa0);
                color: white;
                border: none;
                padding: 12px 25px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.95em;
                font-weight: 600;
                transition: all 0.3s ease;
                white-space: nowrap;
            }

            .btn-barcode-print:hover {
                background: linear-gradient(135deg, #2c5aa0, #1a3a6b);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(26, 58, 107, 0.3);
            }

            .btn-barcode-print:disabled,
            .btn-barcode-generate:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }

            .btn-barcode-action {
                background: linear-gradient(135deg, #1a3a6b, #2c5aa0);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9em;
                font-weight: 500;
                margin: 0 5px;
                transition: all 0.3s ease;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }

            .btn-barcode-action:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(26, 58, 107, 0.4);
            }

            .btn-barcode-action svg {
                width: 16px;
                height: 16px;
            }

            /* Contenedor de Resultados */
            .barcode-results {
                margin-top: 20px;
            }

            .barcode-results-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #e0e0e0;
            }

            .barcode-results-header h3 {
                margin: 0;
                color: #1a3a6b;
                font-size: 1.1em;
            }

            .barcode-count {
                background: #1a3a6b;
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.85em;
                font-weight: 500;
            }

            .barcode-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 20px;
            }

            .barcode-item {
                background: white;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                padding: 15px;
                text-align: center;
                transition: all 0.3s ease;
            }

            .barcode-item:hover {
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                border-color: #2c5aa0;
            }

            .barcode-item-name {
                font-weight: 600;
                color: #333;
                margin-bottom: 10px;
                font-size: 0.9em;
                text-transform: uppercase;
            }

            .barcode-item-code {
                color: #666;
                font-size: 0.8em;
                margin-bottom: 10px;
            }

            .barcode-item svg {
                max-width: 100%;
                height: auto;
            }

            .barcode-empty {
                text-align: center;
                padding: 40px;
                color: #999;
                font-size: 1.1em;
            }

            .barcode-loading {
                text-align: center;
                padding: 40px;
            }

            .barcode-loading-spinner {
                border: 3px solid #f3f3f3;
                border-top: 3px solid #2c5aa0;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            /* Estados */
            .barcode-error {
                background: #fff3f3;
                border: 1px solid #ffcccc;
                color: #c41e3a;
                padding: 15px;
                border-radius: 6px;
                text-align: center;
                margin: 20px 0;
            }

            .barcode-info {
                background: #f0f7ff;
                border: 1px solid #cce5ff;
                color: #1a3a6b;
                padding: 15px;
                border-radius: 6px;
                text-align: center;
                margin: 20px 0;
            }

            /* Estilos de Impresion */
            @media print {
                body * {
                    visibility: hidden;
                }
                .barcode-print-container,
                .barcode-print-container * {
                    visibility: visible;
                }
                .barcode-print-container {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                }
                .barcode-print-item {
                    page-break-inside: avoid;
                    margin-bottom: 20px;
                    padding: 10px;
                    border: 1px solid #ccc;
                    text-align: center;
                }
                .no-print {
                    display: none !important;
                }
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    /**
     * Agrega el boton de generacion de codigos de barras en la vista de inventario
     */
    function _addBarcodeButton(container) {
        const existingButton = document.getElementById('btn-open-barcode');
        if (existingButton) return;

        // Crear contenedor de acciones si no existe
        let actionsContainer = container.querySelector('.inventario-actions, .table-actions, .actions-bar');
        
        if (!actionsContainer) {
            // Buscar el encabezado de la tabla o seccion de inventario
            const headerSection = container.querySelector('h2, h3, .section-title, .inventario-header');
            if (headerSection) {
                actionsContainer = document.createElement('div');
                actionsContainer.className = 'inventario-actions';
                actionsContainer.style.cssText = 'display: flex; align-items: center; gap: 10px; margin: 15px 0; flex-wrap: wrap;';
                headerSection.parentNode.insertBefore(actionsContainer, headerSection.nextSibling);
            } else {
                // Si no hay header, insertar al inicio del contenedor
                actionsContainer = document.createElement('div');
                actionsContainer.className = 'inventario-actions';
                actionsContainer.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;';
                container.insertBefore(actionsContainer, container.firstChild);
            }
        }

        const button = document.createElement('button');
        button.id = 'btn-open-barcode';
        button.className = 'btn-barcode-action';
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 4h4v16H2zM8 4h2v16H8zM14 4h2v16h-2zM18 4h4v16h-4z"/>
                <path d="M6 2v4M14 2v4M22 2v4"/>
            </svg>
            Generar Codigos de Barra
        `;
        button.title = 'Generar codigos de barras del inventario';
        button.addEventListener('click', openBarcodeModal);
        
        actionsContainer.appendChild(button);
    }

    /**
     * Obtiene los insumos del inventario desde Supabase
     */
    async function _getInventoryItems() {
        try {
            // Verificar si supabase esta disponible
            if (typeof supabase !== 'undefined' && supabase.from) {
                const { data, error } = await supabase
                    .from('insumos')
                    .select('*')
                    .order('nombre', { ascending: true });

                if (error) {
                    console.error('Error al obtener insumos de Supabase:', error);
                    throw error;
                }

                return data || [];
            }
            
            // Fallback: Intentar obtener desde Database module
            if (typeof Database !== 'undefined' && typeof Database.getInsumos === 'function') {
                const insumos = await Database.getInsumos();
                return insumos || [];
            }

            // Fallback: Intentar obtener desde window.appState
            if (window.appState && window.appState.insumos) {
                return window.appState.insumos;
            }

            console.warn('No se pudo obtener insumos de Supabase ni de modulos locales');
            return [];
        } catch (error) {
            console.error('Error al obtener items del inventario:', error);
            throw error;
        }
    }

    /**
     * Obtiene las categorias unicas del inventario
     */
    function _getUniqueCategories(items) {
        const categories = new Set();
        items.forEach(item => {
            if (item.categoria) categories.add(item.categoria);
        });
        return Array.from(categories).sort();
    }

    /**
     * Filtra los items segun los criterios seleccionados
     */
    function _filterItems(items, filters) {
        return items.filter(item => {
            // Filtro por categoria
            if (filters.categoria && filters.categoria !== 'todas') {
                if (item.categoria !== filters.categoria) return false;
            }

            // Filtro por busqueda de texto
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                const nombreMatch = item.nombre && item.nombre.toLowerCase().includes(searchTerm);
                const cbMatch = item.cb && item.cb.toString().toLowerCase().includes(searchTerm);
                const descripcionMatch = item.descripcion && item.descripcion.toLowerCase().includes(searchTerm);
                if (!nombreMatch && !cbMatch && !descripcionMatch) return false;
            }

            // Filtro por insumo especifico
            if (filters.insumoEspecifico) {
                if (item.cb !== filters.insumoEspecifico && item.id !== filters.insumoEspecifico) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Genera los codigos de barras para los items filtrados
     */
    function _generateBarcodes(items) {
        const resultsContainer = document.getElementById('barcode-results');
        if (!resultsContainer) return;

        if (!items || items.length === 0) {
            resultsContainer.innerHTML = '<div class="barcode-empty">No se encontraron insumos con los filtros seleccionados</div>';
            return;
        }

        // Mostrar contador y boton de imprimir
        let html = `
            <div class="barcode-results-header">
                <h3>Codigos Generados</h3>
                <span class="barcode-count">${items.length} insumo(s)</span>
            </div>
            <div class="barcode-grid">
        `;

        // Generar HTML para cada item
        items.forEach((item, index) => {
            const itemName = item.nombre || item.descripcion || 'Sin nombre';
            const itemCode = item.cb || item.id || `ITEM-${index}`;
            const barcodeId = `barcode-${index}-${Date.now()}`;
            
            html += `
                <div class="barcode-item">
                    <div class="barcode-item-name">${itemName}</div>
                    <div class="barcode-item-code">CB: ${itemCode}</div>
                    <svg id="${barcodeId}"></svg>
                </div>
            `;
        });

        html += '</div>';
        resultsContainer.innerHTML = html;

        // Generar los SVG de codigos de barras
        items.forEach((item, index) => {
            const itemCode = item.cb || item.id || `ITEM-${index}`;
            const barcodeId = `barcode-${index}-${Date.now()}`;
            
            try {
                if (typeof JsBarcode !== 'undefined') {
                    JsBarcode(`#${barcodeId}`, itemCode.toString(), {
                        format: _config.defaultBarcodeFormat,
                        width: _config.defaultWidth,
                        height: _config.defaultHeight,
                        fontSize: _config.defaultFontSize,
                        margin: _config.defaultMargin,
                        displayValue: true,
                        text: itemCode.toString()
                    });
                } else {
                    // Fallback si JsBarcode no esta disponible
                    const svgElement = document.getElementById(barcodeId);
                    if (svgElement) {
                        svgElement.outerHTML = `<div style="padding: 20px; border: 2px dashed #ccc; border-radius: 4px; font-family: monospace; font-size: 1.2em; letter-spacing: 3px;">${itemCode}</div>`;
                    }
                }
            } catch (error) {
                console.error(`Error generando codigo de barras para ${itemCode}:`, error);
                const svgElement = document.getElementById(barcodeId);
                if (svgElement) {
                    svgElement.outerHTML = `<div style="padding: 10px; color: #c41e3a;">Error al generar codigo</div>`;
                }
            }
        });
    }

    /**
     * Abre el modal de generacion de codigos de barras
     */
    async function openBarcodeModal() {
        // Remover modal existente si lo hay
        const existingModal = document.getElementById('barcode-modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        // Mostrar modal con loading
        const loadingModal = `
            <div id="barcode-modal-overlay" class="barcode-modal-overlay">
                <div class="barcode-modal">
                    <div class="barcode-modal-header">
                        <h2>Generador de Codigos de Barras</h2>
                        <button class="barcode-modal-close" onclick="document.getElementById('barcode-modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="barcode-modal-body">
                        <div class="barcode-loading">
                            <div class="barcode-loading-spinner"></div>
                            <p>Cargando inventario desde la base de datos...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', loadingModal);

        // Cerrar modal al hacer clic fuera
        document.getElementById('barcode-modal-overlay').addEventListener('click', function(e) {
            if (e.target === this) {
                this.remove();
            }
        });

        try {
            // Obtener items de Supabase
            const inventoryItems = await _getInventoryItems();
            
            if (!inventoryItems || inventoryItems.length === 0) {
                const modalBody = document.querySelector('.barcode-modal-body');
                if (modalBody) {
                    modalBody.innerHTML = `
                        <div class="barcode-error">
                            No se encontraron insumos en el inventario. 
                            Verifique la conexion con la base de datos.
                        </div>
                    `;
                }
                return;
            }

            const categories = _getUniqueCategories(inventoryItems);

            // Actualizar el contenido del modal con los filtros
            const modalBody = document.querySelector('.barcode-modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <div class="barcode-filters">
                        <h3>Filtros de Busqueda</h3>
                        <div class="barcode-filter-group">
                            <div class="barcode-filter-item">
                                <label for="barcode-filter-categoria">Categoria</label>
                                <select id="barcode-filter-categoria">
                                    <option value="todas">Todas las categorias</option>
                                    ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                                </select>
                            </div>
                            <div class="barcode-filter-item">
                                <label for="barcode-filter-search">Buscar por Nombre o CB</label>
                                <input type="text" id="barcode-filter-search" placeholder="Ej: Alcohol Gel, CB-123...">
                            </div>
                            <div class="barcode-filter-item">
                                <label for="barcode-filter-insumo">Insumo Especifico (CB)</label>
                                <select id="barcode-filter-insumo">
                                    <option value="">Todos los insumos</option>
                                    ${inventoryItems.map(item => {
                                        const name = item.nombre || item.descripcion || 'Sin nombre';
                                        const code = item.cb || item.id || '';
                                        return `<option value="${code}">${name} (${code})</option>`;
                                    }).join('')}
                                </select>
                            </div>
                            <div class="barcode-filter-actions">
                                <button class="btn-barcode-generate" onclick="BarcodeModule.generateBarcodes()">
                                    Generar Codigos
                                </button>
                                <button class="btn-barcode-print" onclick="BarcodeModule.printBarcodes()" disabled id="btn-print-main">
                                    Imprimir
                                </button>
                            </div>
                        </div>
                    </div>
                    <div id="barcode-results" class="barcode-results">
                        <div class="barcode-empty">
                            Seleccione los filtros y haga clic en "Generar Codigos" para visualizar los codigos de barras
                        </div>
                    </div>
                `;

                // Evento para generar al presionar Enter en el campo de busqueda
                document.getElementById('barcode-filter-search').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        BarcodeModule.generateBarcodes();
                    }
                });

                // Evento para habilitar/deshabilitar boton de imprimir
                document.getElementById('barcode-filter-categoria').addEventListener('change', () => {
                    document.getElementById('btn-print-main').disabled = true;
                });
                document.getElementById('barcode-filter-insumo').addEventListener('change', () => {
                    document.getElementById('btn-print-main').disabled = true;
                });
            }
        } catch (error) {
            const modalBody = document.querySelector('.barcode-modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <div class="barcode-error">
                        Error al cargar el inventario: ${error.message}
                        <br><br>
                        <button class="btn-barcode-generate" onclick="BarcodeModule.openBarcodeModal()">
                            Reintentar
                        </button>
                    </div>
                `;
            }
        }
    }

    /**
     * Genera los codigos de barras basados en los filtros actuales
     */
    async function generateBarcodes() {
        const generateBtn = document.querySelector('.btn-barcode-generate');
        const printBtn = document.getElementById('btn-print-main');
        
        if (generateBtn) generateBtn.disabled = true;
        if (printBtn) printBtn.disabled = true;

        const filters = {
            categoria: document.getElementById('barcode-filter-categoria')?.value || 'todas',
            search: document.getElementById('barcode-filter-search')?.value || '',
            insumoEspecifico: document.getElementById('barcode-filter-insumo')?.value || ''
        };

        // Mostrar loading
        const resultsContainer = document.getElementById('barcode-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="barcode-loading">
                    <div class="barcode-loading-spinner"></div>
                    <p>Generando codigos de barras...</p>
                </div>
            `;
        }

        try {
            const items = await _getInventoryItems();
            const filteredItems = _filterItems(items, filters);
            
            // Pequeno delay para mostrar el loading
            setTimeout(() => {
                _generateBarcodes(filteredItems);
                if (generateBtn) generateBtn.disabled = false;
                if (printBtn && filteredItems.length > 0) printBtn.disabled = false;
            }, 500);
        } catch (error) {
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="barcode-error">
                        Error al generar codigos: ${error.message}
                    </div>
                `;
            }
            if (generateBtn) generateBtn.disabled = false;
        }
    }

    /**
     * Prepara e imprime los codigos de barras generados
     */
    function printBarcodes() {
        const barcodeItems = document.querySelectorAll('.barcode-item');
        
        if (barcodeItems.length === 0) {
            alert('Primero debe generar los codigos de barras antes de imprimir.');
            return;
        }

        // Crear ventana de impresion
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Impresion de Codigos de Barras - Bodega UChile</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    .print-header {
                        text-align: center;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 3px solid #1a3a6b;
                    }
                    .print-header h1 {
                        color: #1a3a6b;
                        font-size: 1.5em;
                        margin-bottom: 5px;
                    }
                    .print-header p {
                        color: #666;
                        font-size: 0.9em;
                    }
                    .print-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 15px;
                    }
                    .print-item {
                        border: 1px solid #ccc;
                        padding: 15px;
                        text-align: center;
                        page-break-inside: avoid;
                    }
                    .print-item-name {
                        font-weight: bold;
                        font-size: 0.8em;
                        margin-bottom: 8px;
                        text-transform: uppercase;
                    }
                    .print-item svg {
                        max-width: 100%;
                        height: auto;
                    }
                    @media print {
                        body { margin: 0; padding: 15px; }
                        .print-grid { grid-template-columns: repeat(2, 1fr); }
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>Codigos de Barras - Inventario Bodega UChile</h1>
                    <p>Fecha: ${new Date().toLocaleDateString('es-CL')} - Total: ${barcodeItems.length} insumos</p>
                    <button class="no-print" onclick="window.print()" style="
                        margin-top: 15px;
                        padding: 10px 30px;
                        background: #1a3a6b;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1em;
                    ">Enviar a Impresora</button>
                </div>
                <div class="print-grid" id="print-grid">
                </div>
                <script>
                    // Copiar los SVG generados cuando la ventana cargue
                    window.onload = function() {
                        const printGrid = document.getElementById('print-grid');
                        if (printGrid && window.opener) {
                            const barcodeItems = window.opener.document.querySelectorAll('.barcode-item');
                            barcodeItems.forEach(item => {
                                const div = document.createElement('div');
                                div.className = 'print-item';
                                div.innerHTML = item.innerHTML;
                                printGrid.appendChild(div);
                            });
                        }
                    };
                </script>
            </body>
            </html>
        `;

        // Abrir ventana de impresion
        if (printWindow) {
            printWindow.close();
        }
        
        printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.write(printContent);
        printWindow.document.close();
    }

    /**
     * Cierra la ventana de impresion
     */
    function closePrintWindow() {
        if (printWindow) {
            printWindow.close();
            printWindow = null;
        }
    }

    // API publica
    return {
        init: init,
        openBarcodeModal: openBarcodeModal,
        generateBarcodes: generateBarcodes,
        printBarcodes: printBarcodes,
        closePrintWindow: closePrintWindow
    };
})();

// Auto-inicializar cuando el DOM este listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => BarcodeModule.init(), 1000);
    });
} else {
    setTimeout(() => BarcodeModule.init(), 1000);
}

// Exponer globalmente para acceso desde HTML
window.BarcodeModule = BarcodeModule;
