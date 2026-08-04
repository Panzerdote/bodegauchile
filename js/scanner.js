// Módulo de escáner deshabilitado para móvil
// Solo se usa pistola lectora USB (funciona como entrada de teclado)
const Scanner = {
    currentScanner: null,

    abrir(tipo) {
        // Ya no se usa la cámara, solo pistola lectora
        UI.showToast('USE LA PISTOLA LECTORA DE CÓDIGOS DE BARRAS', 'warning');
    },

    procesarCodigo(tipo, codigoLimpio) {
        // Este método ya no se llama desde la cámara
        // La pistola lectora ingresa el código directamente en el campo
    },

    stop() {
        // Sin cámara, no hay nada que detener
    }
};
