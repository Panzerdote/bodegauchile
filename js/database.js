// ============================================
// ZONA HORARIA CHILE
// ============================================
function ahoraChile() {
    const ahora = new Date();
    const offsetChile = -4 * 60;
    const offsetLocal = ahora.getTimezoneOffset();
    const diff = (offsetChile - offsetLocal) * 60 * 1000;
    return new Date(ahora.getTime() + diff);
}

// ============================================
// CAPA DE BASE DE DATOS - SUPABASE
// ============================================

const DB = {
    // ============================================
    // SECCIONES
    // ============================================
    async getSecciones() {
        const { data, error } = await supabaseClient
            .from('secciones')
            .select('*')
            .order('seccion')
            .order('anaquel');
        
        if (error) {
            console.error('Error al obtener secciones:', error);
            throw error;
        }
        return data || [];
    },

    async addSeccion(seccion, descripcion, anaquel) {
        const { data, error } = await supabaseClient
            .from('secciones')
            .insert([{ 
                seccion: seccion, 
                descripcion: descripcion || null, 
                anaquel: anaquel 
            }])
            .select();
        
        if (error) {
            console.error('Error al agregar sección:', error);
            if (error.code === '23505') {
                throw new Error('El anaquel ' + seccion + anaquel + ' ya existe');
            }
            throw error;
        }
        return data[0];
    },

    async deleteSeccion(id) {
        const { error } = await supabaseClient
            .from('secciones')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error al eliminar sección:', error);
            throw error;
        }
        return true;
    },

    // ============================================
    // INVENTARIO
    // ============================================
    async getInventario() {
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('*')
            .order('seccion')
            .order('anaquel');
        
        if (error) {
            console.error('Error al obtener inventario:', error);
            throw error;
        }
        return data || [];
    },

    async getInventarioItem(id) {
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) {
            console.error('Error al obtener item:', error);
            throw error;
        }
        return data;
    },

    async addInventarioItem(item) {
        const { data, error } = await supabaseClient
            .from('inventario')
            .insert([{
                nombre: item.nombre,
                seccion: item.seccion,
                anaquel: item.anaquel,
                stock: item.stock || 0,
                unidad: item.unidad || null,
                lote: item.lote || null,
                vencimiento: item.vencimiento || null,
                comentarios: item.comentarios || null
            }])
            .select();
        
        if (error) {
            console.error('Error al agregar item:', error);
            throw error;
        }
        return data[0];
    },

    async updateInventarioItem(id, updates) {
        updates.updated_at = new Date().toISOString();
        
        const { data, error } = await supabaseClient
            .from('inventario')
            .update(updates)
            .eq('id', id)
            .select();
        
        if (error) {
            console.error('Error al actualizar item:', error);
            throw error;
        }
        return data[0];
    },

    async deleteInventarioItem(id) {
        const { error } = await supabaseClient
            .from('inventario')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error al eliminar item:', error);
            throw error;
        }
        return true;
    },

    // ============================================
    // MOVIMIENTOS
    // ============================================
    async getMovimientos(limit = 50) {
        const { data, error } = await supabaseClient
            .from('movimientos')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(limit);
        
        if (error) {
            console.error('Error al obtener movimientos:', error);
            throw error;
        }
        return data || [];
    },

    async getTodosMovimientos() {
        const { data, error } = await supabaseClient
            .from('movimientos')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(1000);
        
        if (error) {
            console.error('Error al obtener movimientos:', error);
            throw error;
        }
        return data || [];
    },

    async addMovimiento(movimiento) {
        const { data, error } = await supabaseClient
            .from('movimientos')
            .insert([{
                fecha: ahoraChile().toISOString(),
                tipo: movimiento.tipo,
                insumo: movimiento.insumo,
                cantidad: movimiento.cantidad || 0,
                stock_anterior: movimiento.stock_anterior !== undefined ? movimiento.stock_anterior : null,
                stock_nuevo: movimiento.stock_nuevo !== undefined ? movimiento.stock_nuevo : null,
                anaquel: movimiento.anaquel || null,
                comentarios: movimiento.comentarios || null,
                usuario: movimiento.usuario || 'web'
            }])
            .select();
        
        if (error) {
            console.error('Error al agregar movimiento:', error);
            throw error;
        }
        return data[0];
    },

    // ============================================
    // CONFIGURACIÓN
    // ============================================
    async getConfig() {
        const { data, error } = await supabaseClient
            .from('configuracion')
            .select('*')
            .order('id')
            .limit(1)
            .single();
        
        if (error) {
            console.error('Error al obtener configuración:', error);
            return { porcentaje_critico: 20, dias_vencimiento: 30 };
        }
        return data;
    },

    // ============================================
    // UNIDADES DE MEDIDA
    // ============================================
    async getUnidadesMedida() {
        const { data, error } = await supabaseClient
            .from('unidades_medida')
            .select('*')
            .order('nombre');
        
        if (error) {
            console.error('Error al obtener unidades:', error);
            throw error;
        }
        return data || [];
    },

    async addUnidadMedida(nombre) {
        const { data, error } = await supabaseClient
            .from('unidades_medida')
            .insert([{ nombre }])
            .select();
        
        if (error) {
            if (error.code === '23505') {
                throw new Error('La unidad "' + nombre + '" ya existe');
            }
            throw error;
        }
        return data[0];
    },

    async deleteUnidadMedida(id) {
        const { error } = await supabaseClient
            .from('unidades_medida')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    },

    // ============================================
    // BÚSQUEDA DE INSUMOS (AUTOCOMPLETADO)
    // ============================================
    async buscarInsumosNombre(busqueda) {
        const { data, error } = await supabaseClient
            .from('inventario')
            .select('nombre, unidad')
            .ilike('nombre', `%${busqueda}%`)
            .order('nombre')
            .limit(10);
        
        if (error) throw error;
        
        const unicos = [];
        const nombres = new Set();
        (data || []).forEach(item => {
            if (!nombres.has(item.nombre.toLowerCase())) {
                nombres.add(item.nombre.toLowerCase());
                unicos.push(item);
            }
        });
        
        return unicos;
    },

    // ============================================
    // OPERACIONES COMBINADAS
    // ============================================
    async procesarIngreso(nombre, seccion, anaquel, cantidad, unidad, lote, vencimiento, comentarios) {
        try {
            const { data: existentes, error: errorBusqueda } = await supabaseClient
                .from('inventario')
                .select('*')
                .ilike('nombre', nombre)
                .eq('anaquel', anaquel);
            
            if (errorBusqueda) throw errorBusqueda;
            
            let itemId;
            let stockAnterior = 0;
            let stockNuevo = cantidad;
            
            if (existentes && existentes.length > 0) {
                const item = existentes[0];
                itemId = item.id;
                stockAnterior = item.stock;
                stockNuevo = stockAnterior + cantidad;
                
                const updates = { stock: stockNuevo };
                if (lote) updates.lote = lote;
                if (vencimiento) updates.vencimiento = vencimiento;
                if (comentarios) updates.comentarios = comentarios;
                if (unidad) updates.unidad = unidad;
                
                await this.updateInventarioItem(itemId, updates);
            } else {
                const nuevo = await this.addInventarioItem({
                    nombre: nombre,
                    seccion: seccion,
                    anaquel: anaquel,
                    stock: cantidad,
                    unidad: unidad || null,
                    lote: lote || null,
                    vencimiento: vencimiento || null,
                    comentarios: comentarios || null
                });
                itemId = nuevo.id;
            }
            
            await this.addMovimiento({
                tipo: 'INGRESO',
                insumo: nombre,
                cantidad: cantidad,
                stock_anterior: stockAnterior,
                stock_nuevo: stockNuevo,
                anaquel: anaquel,
                comentarios: comentarios || null,
                usuario: 'web'
            });
            
            return { itemId, stockNuevo };
        } catch (error) {
            console.error('Error en procesarIngreso:', error);
            throw error;
        }
    },

    async procesarSalida(itemId, cantidad, comentarios) {
        try {
            const item = await this.getInventarioItem(itemId);
            
            if (!item) throw new Error('Insumo no encontrado');
            if (cantidad > item.stock) throw new Error('Stock insuficiente. Stock actual: ' + item.stock);
            if (cantidad <= 0) throw new Error('La cantidad debe ser mayor a 0');
            
            const stockAnterior = item.stock;
            const stockNuevo = stockAnterior - cantidad;
            
            await this.updateInventarioItem(itemId, { stock: stockNuevo });
            
            await this.addMovimiento({
                tipo: 'SALIDA',
                insumo: item.nombre,
                cantidad: cantidad,
                stock_anterior: stockAnterior,
                stock_nuevo: stockNuevo,
                anaquel: item.anaquel,
                comentarios: comentarios || null,
                usuario: 'web'
            });
            
            return { 
                stockNuevo, 
                nombre: item.nombre,
                anaquel: item.anaquel 
            };
        } catch (error) {
            console.error('Error en procesarSalida:', error);
            throw error;
        }
    }
};
