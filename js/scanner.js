const Scanner = {
    currentScanner: null,

    abrir(tipo) {
        const containerId = tipo === 'edicion' ? 'scanner-container-edicion' : `scanner-container-${tipo}`;
        const container = document.getElementById(containerId);
        if (!container) return;
        container.style.display = 'block';
        container.innerHTML = '';
        
        if (this.currentScanner) { 
            this.currentScanner.stop(); 
            this.currentScanner = null;
        }
        
        const html5QrCode = new Html5Qrcode(containerId);
        html5QrCode.start(
            { facingMode: 'environment' }, 
            { fps: 10, qrbox: { width: 250, height: 150 } }, 
            (decodedText) => {
                html5QrCode.stop();
                container.style.display = 'none';
                const codigoLimpio = limpiarCodigoBarras(decodedText);
                this.procesarCodigo(tipo, codigoLimpio);
                this.currentScanner = null;
            }, 
            (errorMessage) => { }
        ).catch(err => { 
            container.style.display = 'none'; 
            UI.showToast('NO SE PUDO ABRIR LA CÁMARA.', 'warning'); 
        });
        
        this.currentScanner = html5QrCode;
    },

    procesarCodigo(tipo, codigoLimpio) {
        switch(tipo) {
            case 'ingreso':
                document.getElementById('ing-codigo-barras').value = codigoLimpio;
                if (typeof App !== 'undefined' && App.buscarPorCodigoBarrasIngreso) {
                    App.buscarPorCodigoBarrasIngreso();
                }
                break;
            case 'salida':
                const campoSalida = document.getElementById('sal-codigo-barras');
                if (campoSalida) campoSalida.value = codigoLimpio;
                if (typeof App !== 'undefined' && App.buscarPorCodigoBarrasSalida) {
                    App.buscarPorCodigoBarrasSalida(codigoLimpio);
                }
                break;
            case 'edicion':
                document.getElementById('edit-codigo-barras').value = codigoLimpio;
                if (typeof App !== 'undefined' && App.buscarPorCodigoBarrasEdicion) {
                    App.buscarPorCodigoBarrasEdicion();
                }
                break;
        }
    },

    stop() {
        if (this.currentScanner) {
            this.currentScanner.stop();
            this.currentScanner = null;
        }
    }
};
