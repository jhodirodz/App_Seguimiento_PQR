import React, { useState, useEffect, useRef } from 'react';

// ===================================================================================
// CaseDetailModal Component
// ===================================================================================
export default function CaseDetailModal({
    caseData,
    onClose,
    onUpdateCase, // Función para actualizar el caso en Firestore (ej: onUpdateCase(id, data))
    onDeleteCase,
    onReopenCase,
    onAssignFromReport,
    onCreateNewCase,
    duplicateCasesDetails,
    displayModalMessage,
    displayConfirmModal,
    nonBusinessDays,
    timePerCaseDay15,
    userId,
    utils,      // Recibimos las utilidades como props
    aiServices, // Recibimos los servicios de IA como props
    constants,  // Recibimos las constantes como props
    allCases,   // Necesario para el cálculo de nota de crédito (snToCunMap)
    scanFileRef, // Ref para el input de escaneo de documentos
    onObsFileClick, // <--- NUEVA PROP: Función que hace click en el input de archivo de observación del padre
}) {

    // --- Estado Interno del Modal (Inicializado con caseData) ---
    const [localCase, setLocalCase] = useState(caseData);

    const [reliquidacionData, setReliquidacionData] = useState([{ id: 1, numeroCuenta: '', valorMensual: '', fechaInicioCiclo: '', fechaFinCiclo: '', fechaBaja: '', montoNotaCredito: null }]);
    const [tieneSNAcumulados, setTieneSNAcumulados] = useState(false);
    const [cantidadSNAcumulados, setCantidadSNAcumulados] = useState(0);
    const [snAcumuladosData, setSnAcumuladosData] = useState([]);
    const [showGestionesAdicionales, setShowGestionesAdicionales] = useState(true);
    const [aseguramientoObs, setAseguramientoObs] = useState('');
    // const observationFileInputRef = useRef(null); <--- ELIMINADO: La ref está ahora en App.jsx

    // Estados de carga para los botones de IA
    const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [isSuggestingEscalation, setIsSuggestingEscalation] = useState(false);
    const [isGeneratingNextActions, setIsGeneratingNextActions] = useState(false);
    const [isGeneratingRootCause, setIsGeneratingRootCause] = useState(false);
    const [isGeneratingEscalationEmail, setIsGeneratingEscalationEmail] = useState(false);
    const [isGeneratingRiskAnalysis, setIsGeneratingRiskAnalysis] = useState(false);
    const [isGeneratingComprehensiveResponse, setIsGeneratingComprehensiveResponse] = useState(false);
    const [isTranscribingObservation, setIsTranscribingObservation] = useState(false); // Mantener si el padre maneja el estado de carga

    // --- Effects para Sincronización y Configuración Inicial ---

    useEffect(() => {
        setLocalCase(caseData);
        // Reiniciar estados internos cuando cambia el caso
        setReliquidacionData([{ id: 1, numeroCuenta: '', valorMensual: '', fechaInicioCiclo: '', fechaFinCiclo: '', fechaBaja: '', montoNotaCredito: null }]);
        setTieneSNAcumulados(false);
        setCantidadSNAcumulados(0);
        setSnAcumuladosData([]);
        setAseguramientoObs('');
    }, [caseData]);

    useEffect(() => {
        if (cantidadSNAcumulados > 0) {
            setSnAcumuladosData(Array.from({ length: cantidadSNAcumulados }, () => ({ sn: '', obs: '' })));
        } else {
            setSnAcumuladosData([]);
        }
    }, [cantidadSNAcumulados]);

    if (!caseData) {
        return null;
    }

    // --- Lógica y Handlers (Adaptados de App.jsx) ---
    
    // Función de ayuda para manejar las actualizaciones del estado local y llamar al padre.
    // **Importante:** Se fusiona la lógica de actualización del estado local con la del padre.
    async function handleModalFieldChange(fieldName, value) {
        let firestoreUpdateData = { [fieldName]: value };
        let newLocalCase = { ...localCase, [fieldName]: value };

        // 1. Lógica de limpieza y transformación de valores (copiada de App.jsx)
        const isChecked = typeof value === 'boolean' ? value : (value === 'true');
        if (fieldName === 'Nombre_Cliente') value = value.toUpperCase();
        else if (fieldName === 'Nro_Nuip_Cliente' && (String(value).startsWith('8') || String(value).startsWith('9')) && String(value).length > 9) value = String(value).substring(0, 9);
        
        // 2. Lógica de campos dependientes (copiada de App.jsx)
        if (fieldName === 'Fecha Radicado') {
            const newAge = utils.calculateCaseAge({ ...newLocalCase, 'Fecha Radicado': value }, nonBusinessDays);
            firestoreUpdateData.Dia = newAge;
            newLocalCase.Dia = newAge;
        }
        if (fieldName === 'isNabis') {
            const newContractType = value ? 'Contrato Marco' : 'Condiciones Uniformes';
            firestoreUpdateData.Tipo_Contrato = newContractType;
            newLocalCase.Tipo_Contrato = newContractType;
        } else {
            if (['Requiere_Aseguramiento_Facturas', 'requiereBaja', 'requiereAjuste'].includes(fieldName)) {
                if (isChecked) { firestoreUpdateData.Despacho_Respuesta_Checked = false; }
                if (!isChecked) {
                    if (fieldName === 'Requiere_Aseguramiento_Facturas') Object.assign(firestoreUpdateData, { ID_Aseguramiento: '', Corte_Facturacion: '', Cuenta: '', Operacion_Aseguramiento: '', Tipo_Aseguramiento: '', Mes_Aseguramiento: '', gestionAseguramientoCompletada: false });
                    else if (fieldName === 'requiereBaja') firestoreUpdateData.numeroOrdenBaja = '';
                    else if (fieldName === 'requiereAjuste') {
                        Object.assign(firestoreUpdateData, { numeroTT: '', estadoTT: '', requiereDevolucionDinero: false, cantidadDevolver: '', idEnvioDevoluciones: '', fechaEfectivaDevolucion: '' });
                        if (localCase.Estado_Gestion === 'Pendiente Ajustes') firestoreUpdateData.Estado_Gestion = 'Pendiente';
                    }
                }
            } else if (fieldName === 'requiereDevolucionDinero' && !isChecked) { Object.assign(firestoreUpdateData, { cantidadDevolver: '', idEnvioDevoluciones: '', fechaEfectivaDevolucion: '' }); }
            
            if (fieldName === 'gestionAseguramientoCompletada') { firestoreUpdateData.gestionAseguramientoCompletada = value; }
            if (fieldName === 'estadoTT' && localCase.requiereAjuste) {
                if (value === 'Pendiente' && localCase.Estado_Gestion !== 'Pendiente Ajustes') {
                    firestoreUpdateData.Estado_Gestion = 'Pendiente Ajustes';
                    displayModalMessage('El estado del caso ha cambiado a "Pendiente Ajustes".');
                }
            } else if (fieldName === 'areaEscalada') { firestoreUpdateData.motivoEscalado = ''; }
        }
        
        // 3. Actualizar el estado local (usando el valor actualizado)
        setLocalCase(prev => ({ ...prev, ...firestoreUpdateData, [fieldName]: value }));

        // 4. Llamar a la función del componente padre para persistir en Firestore
        onUpdateCase(localCase.id, firestoreUpdateData);
    }
    
    function handleContractTypeChange(newContractType) {
        const updateData = { Tipo_Contrato: newContractType };
        if (newContractType !== 'Contrato Marco') { updateData.isNabis = false; }
        setLocalCase(prev => ({ ...prev, ...updateData }));
        onUpdateCase(localCase.id, updateData);
    }
    
    async function handleSaveEscalamientoHistory() {
        if (!localCase.areaEscalada || !localCase.motivoEscalado) { displayModalMessage('Debe seleccionar el área y el motivo de la escalación para guardar.'); return; }
        const escalamientoData = {
            timestamp: new Date().toISOString(),
            areaEscalada: localCase.areaEscalada, motivoEscalado: localCase.motivoEscalado,
            idEscalado: localCase.idEscalado || '', reqGenerado: localCase.reqGenerado || '', descripcionEscalamiento: localCase.descripcionEscalamiento || ''
        };
        const newHistory = [...(localCase.Escalamiento_Historial || []), escalamientoData];
        setLocalCase(prev => ({ ...prev, Escalamiento_Historial: newHistory }));
        onUpdateCase(localCase.id, { Escalamiento_Historial: newHistory });
        displayModalMessage('Historial de escalación guardado.');
    }

    const handleSNAcumuladoInputChange = (index, field, value) => {
        setSnAcumuladosData(prev => {
            const newForms = [...prev];
            newForms[index][field] = value;
            return newForms;
        });
    };

    async function handleSaveSNAcumulados() {
        if (snAcumuladosData.some(item => !item.sn.trim())) { displayModalMessage('Todos los campos de SN acumulados deben estar llenos antes de guardar.'); return; }
        // Asegúrate de que allCases se pase correctamente y tenga la estructura SN/CUN
        const snToCunMap = new Map(allCases.map(c => [String(c.SN || '').trim(), c.CUN]));
        const newHistory = snAcumuladosData.map(item => ({ sn: item.sn.trim(), cun: snToCunMap.get(item.sn.trim()) || 'No encontrado', obs: item.obs, timestamp: new Date().toISOString() }));
        const updatedHistory = [...(localCase.SNAcumulados_Historial || []), ...newHistory];
        
        setLocalCase(prev => ({ ...prev, SNAcumulados_Historial: updatedHistory }));
        onUpdateCase(localCase.id, { SNAcumulados_Historial: updatedHistory });
        
        displayModalMessage('SN Acumulados guardados exitosamente.');
        setCantidadSNAcumulados(0);
        setSnAcumuladosData([]);
        setTieneSNAcumulados(false);
    }
    
    async function handleSaveAseguramientoHistory() {
        const assuranceData = {
            timestamp: new Date().toISOString(), observaciones: aseguramientoObs, Requiere_Aseguramiento_Facturas: localCase.Requiere_Aseguramiento_Facturas || false,
            ID_Aseguramiento: localCase.ID_Aseguramiento || '', Corte_Facturacion: localCase.Corte_Facturacion || '', Cuenta: localCase.Cuenta || '',
            Operacion_Aseguramiento: localCase.Operacion_Aseguramiento || '', Tipo_Aseguramiento: localCase.Tipo_Aseguramiento || '',
            Mes_Aseguramiento: localCase.Mes_Aseguramiento || '', requiereBaja: localCase.requiereBaja || false, numeroOrdenBaja: localCase.numeroOrdenBaja || '',
            requiereAjuste: localCase.requiereAjuste || false, numeroTT: localCase.numeroTT || '', estadoTT: localCase.estadoTT || '',
            requiereDevolucionDinero: localCase.requiereDevolucionDinero || false, cantidadDevolver: localCase.cantidadDevolver || '',
            idEnvioDevoluciones: localCase.idEnvioDevoluciones || '', fechaEfectivaDevolucion: localCase.fechaEfectivaDevolucion || ''
        };
        const newHistory = [...(localCase.Aseguramiento_Historial || []), assuranceData];
        
        setLocalCase(prev => ({ ...prev, Aseguramiento_Historial: newHistory }));
        onUpdateCase(localCase.id, { Aseguramiento_Historial: newHistory });
        
        displayModalMessage('Historial de aseguramiento guardado.');
        setAseguramientoObs('');
    }

    const handleReliquidacionChange = (index, e) => {
        const { name, value } = e.target;
        setReliquidacionData(prev => {
            const newForms = [...prev];
            newForms[index][name] = value;
            return newForms;
        });
    };

    const handleAddForm = () => {
        const newId = reliquidacionData.length > 0 ? Math.max(...reliquidacionData.map(f => f.id)) + 1 : 1;
        setReliquidacionData(prev => [...prev, {
            id: newId, numeroCuenta: '', valorMensual: '', fechaInicioCiclo: '', fechaFinCiclo: '', fechaBaja: '', montoNotaCredito: null,
        }]);
    };

    const handleRemoveForm = (idToRemove) => {
        setReliquidacionData(prev => prev.filter(form => form.id !== idToRemove));
    };

    async function calcularNotaCredito() {
        const newForms = reliquidacionData.map(form => {
            const { numeroCuenta, fechaInicioCiclo, fechaFinCiclo, fechaBaja, valorMensual } = form;
            if (!numeroCuenta || !fechaInicioCiclo || !fechaFinCiclo || !fechaBaja || !valorMensual) {
                displayModalMessage(`Por favor, complete todos los campos para la cuenta ${numeroCuenta || 'sin nombre'}.`);
                return form;
            }
            const start = new Date(fechaInicioCiclo + 'T00:00:00-05:00');
            const end = new Date(fechaFinCiclo + 'T00:00:00-05:00');
            const baja = new Date(fechaBaja + 'T00:00:00-05:00');
            if (isNaN(start) || isNaN(end) || isNaN(baja)) {
                displayModalMessage("Una de las fechas ingresadas no es válida.");
                return form;
            }
            if (baja < start || baja > end) {
                displayModalMessage(`La fecha de baja debe estar dentro del ciclo de facturación para la cuenta ${numeroCuenta}.`);
                return form;
            }
            const diasTotales = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;
            const diasAReliquidar = (end.getTime() - baja.getTime()) / (1000 * 60 * 60 * 24) + 1;
            const valorDiario = parseFloat(valorMensual) / diasTotales;
            const monto = valorDiario * diasAReliquidar;
            return { ...form, montoNotaCredito: monto.toFixed(2) };
        });
        setReliquidacionData(newForms);
        const newObservationText = newForms.map(form => `Cálculo de nota de crédito para Cuenta ${form.numeroCuenta}:\n- Ciclo: ${form.fechaInicioCiclo} a ${form.fechaFinCiclo}\n- Fecha de baja: ${form.fechaBaja}\n- Valor mensual: $${form.valorMensual}\n- Monto a reliquidar: $${form.montoNotaCredito}`).join('\n\n');
        const newHistoryEntry = { text: newObservationText, timestamp: new Date().toISOString() };
        const updatedHistory = [...(localCase.Observaciones_Historial || []), newHistoryEntry];
        
        setLocalCase(prev => ({ ...prev, Observaciones_Historial: updatedHistory }));
        onUpdateCase(localCase.id, { Observaciones_Historial: updatedHistory });
        
        displayModalMessage("Cálculo de nota de crédito completado y guardado en el historial.");
    }
    
    // --- Lógica de Gestión de Casos (Copia de App.jsx, simplificando la actualización) ---

    async function proceedWithResolve() {
        if (!localCase) return;

        // ... (Validaciones: Despacho_Respuesta_Checked, Aseguramiento, Baja, Ajuste - idénticas a App.jsx) ...
        if (!localCase.Despacho_Respuesta_Checked && !localCase.Requiere_Aseguramiento_Facturas && !localCase.requiereBaja && !localCase.requiereAjuste) { displayModalMessage('Debe seleccionar "Despacho Respuesta" o una opción de "Gestiones Adicionales" para resolver.'); return; }
        if (localCase.Requiere_Aseguramiento_Facturas && !localCase.ID_Aseguramiento && (!localCase.Corte_Facturacion || isNaN(parseFloat(localCase.Corte_Facturacion)) || !localCase.Cuenta || !localCase.Operacion_Aseguramiento || !localCase.Tipo_Aseguramiento || !localCase.Mes_Aseguramiento)) { displayModalMessage('Para resolver con Aseguramiento, complete todos los campos requeridos.'); return; }
        if (localCase.requiereBaja && !localCase.numeroOrdenBaja) { displayModalMessage('Si requiere baja, debe ingresar el Número de Orden de Baja.'); return; }
        if (localCase.requiereAjuste) {
            if (!localCase.numeroTT) { displayModalMessage('Si requiere ajuste, debe ingresar el Número de TT.'); return; }
            if (localCase.estadoTT !== 'Aplicado') { displayModalMessage('Si requiere ajuste, el Estado TT debe ser "Aplicado".'); return; }
            if (localCase.requiereDevolucionDinero && (!localCase.cantidadDevolver || isNaN(parseFloat(localCase.cantidadDevolver)) || parseFloat(localCase.cantidadDevolver) <= 0 || !localCase.idEnvioDevoluciones || !localCase.fechaEfectivaDevolucion)) { displayModalMessage('Si requiere devolución, complete todos los campos de devolución.'); return; }
        }
        if ((localCase.Requiere_Aseguramiento_Facturas || localCase.requiereBaja || localCase.requiereAjuste) && !localCase.gestionAseguramientoCompletada) {
            displayModalMessage('Error: El caso tiene gestiones adicionales pendientes. Debe marcar la casilla "Marcar gestión de aseguramiento como completada" antes de resolver.');
            return;
        }

        const today = utils.getColombianDateISO();
        let newObservations = [...(localCase.Observaciones_Historial || [])];
        if (localCase.SNAcumulados_Historial && localCase.SNAcumulados_Historial.length > 0) {
            const accumulatedSNs = localCase.SNAcumulados_Historial.map(item => item.sn.trim()).filter(Boolean);
            if(accumulatedSNs.length > 0) {
                const snListString = accumulatedSNs.join(', ');
                const mainAnnotationText = `Caso resuelto. Se cerraron también los siguientes SN Acumulados: ${snListString}`;
                newObservations.push({ text: mainAnnotationText, timestamp: new Date().toISOString() });
            }
        }
        
        const dataToUpdate = {
            Estado_Gestion: 'Resuelto', 
            'Fecha Cierre': today,
            Tiempo_Resolucion_Minutos: localCase.Fecha_Inicio_Gestion ? utils.getDurationInMinutes(localCase.Fecha_Inicio_Gestion, new Date().toISOString()) : 'N/A',
            Tiempo_Gestion_Dia15_Congelado: timePerCaseDay15, // Se recibe como prop
            Observaciones_Historial: newObservations
        };
        
        onUpdateCase(localCase.id, dataToUpdate, true); // true indica que también hay que cerrar acumulados en el padre
        onClose(); // Cerrar el modal
    }

    async function handleDecretarCaso() {
        if (!localCase.Despacho_Respuesta_Checked) { displayModalMessage("Error: Para decretar el caso, primero debe marcar la casilla 'Despacho Respuesta'."); return; }
        if (!Array.isArray(localCase.Escalamiento_Historial) || localCase.Escalamiento_Historial.length === 0) { displayModalMessage("Error: Debe guardar un registro de escalación antes de decretar el caso."); return; }
        if (!localCase.Radicado_SIC || !localCase.Fecha_Vencimiento_Decreto) { displayModalMessage("Error: Debe completar los campos 'Radicado SIC' y 'Fecha Vencimiento Decreto' para poder decretar."); return; }
        displayConfirmModal('¿Está seguro de que desea decretar este caso? Esta acción resolverá el caso actual y creará uno nuevo en estado "Decretado".', { onConfirm: () => { onCreateNewCase(localCase, 'Decretado'); onClose(); }, confirmText: 'Sí, decretar', cancelText: 'No, cancelar' });
    }

    async function handleTrasladoSIC() {
        if (!localCase.Despacho_Respuesta_Checked) { displayModalMessage("Error: Para trasladar el caso a SIC, primero debe marcar la casilla 'Despacho Respuesta'."); return; }
        if (!localCase.Radicado_SIC || !localCase.Fecha_Vencimiento_Decreto) { displayModalMessage("Error: Debe completar los campos 'Radicado SIC' y 'Fecha Vencimiento Decreto' para poder trasladar a SIC."); return; }
        displayConfirmModal('¿Está seguro de que desea trasladar este caso a SIC? Esta acción resolverá el caso actual y creará uno nuevo en estado "Traslado SIC".', { onConfirm: () => { onCreateNewCase(localCase, 'Traslado SIC'); onClose(); }, confirmText: 'Sí, trasladar a SIC', cancelText: 'No, cancelar' });
    }

    async function handleChangeCaseStatus(newStatus) {
        if (newStatus === 'Decretado') { handleDecretarCaso(); return; }
        if (newStatus === 'Traslado SIC') { handleTrasladoSIC(); return; }
        if (newStatus === 'Resuelto') {
            const needsAssuranceCheck = !localCase.Requiere_Aseguramiento_Facturas && !localCase.requiereBaja && !localCase.requiereAjuste;
            if (needsAssuranceCheck) {
                displayConfirmModal('¿Confirma que el caso NO requiere "Aseguramiento y Gestiones Adicionales"?', { onConfirm: proceedWithResolve, onCancel: () => { displayModalMessage('Gestiones adicionales requeridas.'); setShowGestionesAdicionales(true); }, confirmText: 'No, no requiere', cancelText: 'Sí, requiere gestión' });
            } else { await proceedWithResolve(); }
        } else {
            const data = { Estado_Gestion: newStatus };
            if (localCase.Estado_Gestion === 'Escalado' && newStatus !== 'Escalado') Object.assign(data, { areaEscalada: '', motivoEscalado: '', idEscalado: '', reqGenerado: '', descripcionEscalamiento: '' });
            if (newStatus === 'Iniciado') Object.assign(data, { Fecha_Inicio_Gestion: new Date().toISOString(), Tiempo_Resolucion_Minutos: 'N/A' });
            
            setLocalCase(prev => ({ ...prev, ...data }));
            onUpdateCase(localCase.id, data);
        }
    }

    async function handleDespachoRespuestaChange(e) {
        const isChecked = e.target.checked;
        let updateData = { Despacho_Respuesta_Checked: isChecked };
        if (isChecked) {
            updateData = {
                ...updateData,
                Requiere_Aseguramiento_Facturas: false, requiereBaja: false, requiereAjuste: false, requiereDevolucionDinero: false,
                ID_Aseguramiento: '', Corte_Facturacion: '', Cuenta: '', Operacion_Aseguramiento: '', Tipo_Aseguramiento: '', Mes_Aseguramiento: '',
                numeroOrdenBaja: '', numeroTT: '', estadoTT: '', cantidadDevolver: '', idEnvioDevoluciones: '', fechaEfectivaDevolucion: '',
            };
            if (isChecked && localCase.Estado_Gestion === 'Pendiente Ajustes') { updateData.Estado_Gestion = 'Pendiente'; }
        }
        setLocalCase(prev => ({ ...prev, ...updateData }));
        onUpdateCase(localCase.id, updateData);
    }
    
    // Handlers de IA
    async function generateAIAnalysisHandler() { setIsGeneratingAnalysis(true); try { const res = await aiServices.getAIAnalysisAndCategory(localCase); setLocalCase(prev => ({ ...prev, ...res })); onUpdateCase(localCase.id, res); } catch (e) { displayModalMessage(`Error AI Analysis: ${e.message}`); } finally { setIsGeneratingAnalysis(false); } }
    async function generateAISummaryHandler() { setIsGeneratingSummary(true); try { const sum = await aiServices.getAISummary(localCase); setLocalCase(prev => ({ ...prev, Resumen_Hechos_IA: sum })); onUpdateCase(localCase.id, { Resumen_Hechos_IA: sum }); } catch (e) { displayModalMessage(`Error AI Summary: ${e.message}`); } finally { setIsGeneratingSummary(false); } }
    async function generateNextActionsHandler() { setIsGeneratingNextActions(true); try { const actions = await aiServices.getAINextActions(localCase); setLocalCase(prev => ({ ...prev, Sugerencias_Accion_IA: actions })); onUpdateCase(localCase.id, { Sugerencias_Accion_IA: actions }); } catch (e) { displayModalMessage(`Error generando próximas acciones: ${e.message}`); } finally { setIsGeneratingNextActions(false); } }
    async function generateRootCauseHandler() { setIsGeneratingRootCause(true); try { const cause = await aiServices.getAIRootCause(localCase); setLocalCase(prev => ({ ...prev, Causa_Raiz_IA: cause })); onUpdateCase(localCase.id, { Causa_Raiz_IA: cause }); } catch (e) { displayModalMessage(`Error generando causa raíz: ${e.message}`); } finally { setIsGeneratingRootCause(false); } }
async function handleSuggestEscalation() { 
    setIsSuggestingEscalation(true); 
    displayModalMessage('La IA está sugiriendo una escalación...'); 
    try { 
        const suggestion = await aiServices.getAIEscalationSuggestion(localCase); 
        if (suggestion.area && suggestion.motivo) { 
            const firestoreUpdateData = { 
                areaEscalada: suggestion.area, 
                motivoEscalado: suggestion.motivo,
                // Reiniciamos los campos manuales para que la IA sea el punto de partida
                idEscalado: '',
                reqGenerado: '',
                descripcionEscalamiento: '' 
            }; 
            
            // 1. Aplicar la sugerencia a los campos
            setLocalCase(prev => ({ ...prev, ...firestoreUpdateData })); 
            // **IMPORTANTE**: Actualizamos Firestore y luego guardamos el historial automáticamente.
            await new Promise(resolve => onUpdateCase(localCase.id, firestoreUpdateData, resolve)); // Esperamos la actualización
            
            // 2. Guardar el historial de escalación inmediatamente después de la sugerencia
            // Se asume que handleSaveEscalamientoHistory usa el localCase actualizado.
            await handleSaveEscalamientoHistory(true); // Se usa un flag para evitar el mensaje doble
            
            displayModalMessage('Sugerencia de escalación aplicada y guardada en el historial.'); 
        } else { 
            displayModalMessage('No se pudo obtener una sugerencia válida de la IA.'); 
        } 
    } catch (e) { 
        displayModalMessage(`Error con la IA: ${e.message}`); 
    } finally { 
        setIsSuggestingEscalation(false); 
    } 
}    async function generateEscalationEmailHandler() { setIsGeneratingEscalationEmail(true); try { const emailBody = await aiServices.getAIEscalationEmail(localCase); setLocalCase(prev => ({ ...prev, Correo_Escalacion_IA: emailBody })); onUpdateCase(localCase.id, { Correo_Escalacion_IA: emailBody }); } catch (e) { displayModalMessage(`Error generando correo de escalación: ${e.message}`); } finally { setIsGeneratingEscalationEmail(false); } }
    async function generateRiskAnalysisHandler() { setIsGeneratingRiskAnalysis(true); try { const risk = await aiServices.getAIRiskAnalysis(localCase); setLocalCase(prev => ({ ...prev, Riesgo_SIC: risk })); onUpdateCase(localCase.id, { Riesgo_SIC: risk }); } catch (e) { displayModalMessage(`Error generando análisis de riesgo: ${e.message}`); } finally { setIsGeneratingRiskAnalysis(false); } }
    async function generateAIComprehensiveResponseHandler() { setIsGeneratingComprehensiveResponse(true); try { const res = await aiServices.getAIComprehensiveResponse(localCase, localCase.Tipo_Contrato || 'Condiciones Uniformes'); const validation = await aiServices.getAIValidation({ ...localCase, Respuesta_Integral_IA: res }); setLocalCase(prev => ({ ...prev, Respuesta_Integral_IA: res, Validacion_IA: validation })); onUpdateCase(localCase.id, { Respuesta_Integral_IA: res, Validacion_IA: validation }); displayModalMessage('Respuesta integral generada y validada exitosamente.'); } catch (e) { displayModalMessage(`Error AI Comprehensive Response: ${e.message}`); } finally { setIsGeneratingComprehensiveResponse(false); } }
    
    // Handlers de Observaciones y Transcripción
    const handleObservationsChange = (e) => setLocalCase(prev => ({ ...prev, Observaciones: e.target.value }));
    async function saveObservation() {
        if (!localCase.Observaciones?.trim()) { displayModalMessage('Escriba observación.'); return; }
        const newHist = { text: localCase.Observaciones.trim(), timestamp: new Date().toISOString() };
        const updatedHist = [...(localCase.Observaciones_Historial || []), newHist];
        setLocalCase(prev => ({ ...prev, Observaciones_Historial: updatedHist, Observaciones: '' }));
        onUpdateCase(localCase.id, { Observaciones_Historial: updatedHist, Observaciones: '' });
        displayModalMessage('Observación guardada.');
    }
    
    // Función de ayuda para activar el input de archivo del componente padre
    // Simplemente llama a la prop onObsFileClick
    function handleObservationFileUploadClick() {
        if (onObsFileClick) {
            onObsFileClick();
        } else {
            displayModalMessage("Error: La función de transcripción no está disponible (onObsFileClick no se pasó como prop).");
        }
    }


    // --- Estilos de ayuda (copiados de App.jsx) ---
    const statusColors = constants.statusColors;
    const priorityColors = constants.priorityColors;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[120] p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full mx-auto overflow-y-auto max-h-[90vh]">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Detalles del Caso: {localCase.SN}</h3>
                
                {/* Input de archivo oculto para la transcripción de observaciones - ELIMINADO EL REF LOCAL */}
                {/* <input type="file" ref={observationFileInputRef} onChange={e => {
                     // Llama al handler en el padre si la lógica de la API no está aquí
                     // En este ejemplo, el handler debe ser pasado por el padre y manejar el archivo.
                     // Aquí se simula la llamada al handler local (incompleto)
                     handleObservationFileUpload(e);
                }} accept="image/png, image/jpeg, application/pdf, text/csv, audio/*" style={{ display: 'none' }} /> */}

                {/* Se mantiene el input para el escaneo de documentos (documentos de reclamo) */}
                <input type="file" ref={scanFileRef} style={{ display: 'none' }} />

                {duplicateCasesDetails.length > 0 && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <strong className="font-bold">¡Alerta!</strong><span className="block sm:inline ml-2">{duplicateCasesDetails.length} caso(s) relacionado(s) encontrado(s).</span>
                        <ul className="mt-2 list-disc list-inside">
                            {duplicateCasesDetails.map(d => (
                                <li key={d.id} className="text-sm flex justify-between items-center">
                                    <span>SN: {d.SN}, CUN: {d.CUN || 'N/A'}, Cliente: {d.Nombre_Cliente} (Match por {d.type})</span>
                                    {d.type === 'Reporte Cruce' && !d.isAssigned && (<button onClick={() => onAssignFromReport(d.data)} className="ml-4 px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">Asignar</button>)}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {['SN', 'CUN', 'Fecha Radicado', 'Fecha Cierre', 'fecha_asignacion', 'user',
        'Estado_Gestion', 'Fecha_Inicio_Gestion', 'Tiempo_Resolucion_Minutos',
        'Radicado_SIC', 'Fecha_Vencimiento_Decreto', 'Dia', 'Fecha Vencimiento',
        'Tipo_Contrato', 'Numero_Contrato_Marco', 'isNabis', 'Nombre_Cliente',
        'Nro_Nuip_Cliente', 'Correo_Electronico_Cliente', 'Direccion_Cliente',
        'Ciudad_Cliente', 'Depto_Cliente', 'Nombre_Reclamante', 'Nro_Nuip_Reclamante',
        'Correo_Electronico_Reclamante', 'Direccion_Reclamante', 'Ciudad_Reclamante',
        'Depto_Reclamante', 'HandleNumber', 'AcceptStaffNo', 'type_request',
        'obs', 'Numero_Reclamo_Relacionado', 'nombre_oficina', 'Tipopago',
        'date_add', 'Tipo_Operacion', 'Prioridad', 'Analisis de la IA',
        'Categoria del reclamo', 'Resumen_Hechos_IA', 'Documento_Adjunto'].map(header => {
                        const nonEditableFields = ['CUN', 'fecha_asignacion', 'user', 'Estado_Gestion', 'Fecha_Inicio_Gestion', 'Tiempo_Resolucion_Minutos', 'Resumen_Hechos_IA', 'date_add'];
                        const dateFields = ['Fecha Radicado', 'Fecha Cierre', 'Fecha_Vencimiento_Decreto', 'Fecha Vencimiento'];
                        const textAreaFields = ['obs', 'Analisis de la IA'];
                        let isEditable = !nonEditableFields.includes(header);
                        if (header === 'SN' && localCase.Estado_Gestion !== 'Decretado') { isEditable = false; }
                        
                        // Lógica de isNabis
                        if (header === 'isNabis') {
                            return (<div key={header} className="bg-gray-50 p-3 rounded-md flex items-center"><label className="inline-flex items-center cursor-pointer"><input type="checkbox" className="form-checkbox h-5 w-5" checked={localCase.isNabis || false} onChange={e => handleModalFieldChange('isNabis', e.target.checked)} /><span className="ml-2 font-semibold">Es CM Nabis</span></label></div>);
                        }
                        // Lógica de Tipo_Contrato
                        if (header === 'Tipo_Contrato') {
                            return (<div key={header} className="bg-gray-50 p-3 rounded-md"><label htmlFor="modal-Tipo_Contrato" className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Contrato:</label><select id="modal-Tipo_Contrato" value={localCase.Tipo_Contrato || 'Condiciones Uniformes'} onChange={e => handleContractTypeChange(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm p-2"><option value="Condiciones Uniformes">Condiciones Uniformes</option><option value="Contrato Marco">Contrato Marco</option></select></div>);
                        }
                        // Lógica de Prioridad
                        if (header === 'Prioridad') {
                            return (<div key={header} className="bg-gray-50 p-3 rounded-md"><label htmlFor="modal-Prioridad" className="block text-sm font-semibold text-gray-700 mb-1">Prioridad:</label><select id="modal-Prioridad" value={localCase.Prioridad || ''} onChange={(e) => handleModalFieldChange('Prioridad', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm p-2"><option value="">Seleccione...</option>{constants.ALL_PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>);
                        }
                        // Lógica de Radicado_SIC y Fecha_Vencimiento_Decreto
                        if (header === 'Radicado_SIC' || header === 'Fecha_Vencimiento_Decreto') {
                            return (<div key={header} className="bg-gray-50 p-3 rounded-md"><label htmlFor={`modal-${header}`} className="block text-sm font-semibold text-gray-700 mb-1">{header.replace(/_/g, ' ')}:</label><input type={header === 'Fecha_Vencimiento_Decreto' ? 'date' : 'text'} id={`modal-${header}`} value={localCase[header] || ''} onChange={e => handleModalFieldChange(header, e.target.value)} className="block w-full rounded-md p-2" /></div>);
                        }
                        
                        const isDate = dateFields.includes(header);
                        const isTextArea = textAreaFields.includes(header);
                        return (<React.Fragment key={header}>
                            <div className={`bg-gray-50 p-3 rounded-md ${isTextArea || header === 'Resumen_Hechos_IA' || header === 'Observaciones_Reclamo_Relacionado' ? 'lg:col-span-3 md:col-span-2' : ''}`}>
                                <label htmlFor={`modal-${header}`} className="block text-sm font-semibold text-gray-700 mb-1">{header.replace(/_/g, ' ')}:</label>
                                {isEditable ? (
                                    <>
                                        <div className="relative">
                                            {isTextArea ? (
                                                <textarea id={`modal-${header}`} rows={3} className="block w-full rounded-md p-2 pr-10" value={localCase[header] || ''} onChange={e => handleModalFieldChange(header, e.target.value)} />
                                            ) : (
                                                <input type={isDate ? 'date' : header === 'Dia' ? 'number' : 'text'} id={`modal-${header}`} className="block w-full rounded-md p-2 pr-10" value={header === 'Dia' ? utils.calculateCaseAge(localCase, nonBusinessDays) : (localCase[header] || '')} onChange={e => handleModalFieldChange(header, e.target.value)} />
                                            )}
                                            {['obs', 'Analisis de la IA'].includes(header) && (
                                                <button onClick={() => utils.copyToClipboard(localCase[header] || '', header.replace(/_/g, ' '), displayModalMessage)} className="absolute top-1 right-1 p-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded" title={`Copiar ${header.replace(/_/g, ' ')}`}>Copiar</button>
                                            )}
                                        </div>
                                        {(header === 'obs' || header === 'Analisis de la IA') && (
                                            <button onClick={generateAIAnalysisHandler} className="mt-2 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50" disabled={isGeneratingAnalysis}>{isGeneratingAnalysis ? 'Regenerando...' : 'Regenerar Análisis y Categoría'}</button>
                                        )}
                                    </>
                                ) : header === 'user' ? (
                                    <div className="flex items-center gap-2">
                                        <input type="text" id="caseUser" value={localCase.user || ''} readOnly className="block w-full rounded-md p-2 bg-gray-100" />
                                        <button onClick={() => onUpdateCase(localCase.id, {user: userId})} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Asignar</button>
                                    </div>
                                ) : header === 'Resumen_Hechos_IA' ? (
                                    <div className="relative">
                                        <textarea rows="3" className="block w-full rounded-md p-2 pr-10 bg-gray-100" value={localCase.Resumen_Hechos_IA || 'No generado'} readOnly />
                                        <button onClick={() => utils.copyToClipboard(localCase.Resumen_Hechos_IA || '', 'Resumen Hechos IA', displayModalMessage)} className="absolute top-1 right-1 p-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded" title="Copiar Resumen Hechos IA">Copiar</button>
                                        <button onClick={generateAISummaryHandler} className="mt-2 px-3 py-1.5 bg-teal-600 text-white rounded-md text-sm" disabled={isGeneratingSummary}>{isGeneratingSummary ? 'Generando...' : 'Generar Resumen IA'}</button>
                                    </div>
                                ) : <p className={`text-base break-words`}>{localCase[header] || 'N/A'}</p>}
                            </div>
                            {header === 'Numero_Reclamo_Relacionado' && localCase.Numero_Reclamo_Relacionado && localCase.Numero_Reclamo_Relacionado !== 'N/A' && (
                                <div className="bg-gray-50 p-3 rounded-md lg:col-span-2 md:col-span-2">
                                    <label htmlFor="Observaciones_Reclamo_Relacionado" className="block text-sm font-semibold text-gray-700 mb-1">Observaciones del Reclamo Relacionado:</label>
                                    <textarea id="Observaciones_Reclamo_Relacionado" rows="3" className="block w-full rounded-md p-2" value={localCase.Observaciones_Reclamo_Relacionado || ''} onChange={e => handleModalFieldChange('Observaciones_Reclamo_Relacionado', e.target.value)} placeholder="Añadir observaciones sobre el reclamo relacionado..." />
                                </div>
                            )}
                        </React.Fragment>);
                    })}
                </div>
                
                {/* SUGERENCIAS DE ACCIÓN Y CAUSA RAÍZ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="p-4 border rounded-lg bg-indigo-50">
                        <h4 className="text-lg font-semibold text-indigo-800 mb-3">Sugerencias de Próxima Acción (IA)</h4>
                        {isGeneratingNextActions ? (<p className="text-sm text-indigo-700">Generando sugerencias...</p>) : (<>{(!localCase.Sugerencias_Accion_IA || localCase.Sugerencias_Accion_IA.length === 0) ? (<button onClick={generateNextActionsHandler} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm">✨ Generar Próximas Acciones</button>) : (<div><ul className="list-disc list-inside space-y-2 text-sm text-gray-800">{(Array.isArray(localCase.Sugerencias_Accion_IA) ? localCase.Sugerencias_Accion_IA : []).map((action, index) => <li key={index}>{action}</li>)}</ul><button onClick={generateNextActionsHandler} className="mt-3 px-3 py-1 bg-indigo-200 text-indigo-800 rounded-md hover:bg-indigo-300 text-xs">✨ Regenerar</button></div>)}</>)}
                    </div>
                    {(localCase.Estado_Gestion === 'Resuelto' || localCase.Estado_Gestion === 'Finalizado') && (<div className="p-4 border rounded-lg bg-green-50">
                        <h4 className="text-lg font-semibold text-green-800 mb-3">Análisis de Causa Raíz (IA)</h4>
                        {isGeneratingRootCause ? (<p className="text-sm text-green-700">Generando análisis...</p>) : (<>{!localCase.Causa_Raiz_IA ? (<button onClick={generateRootCauseHandler} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">✨ Analizar Causa Raíz</button>) : (<div><p className="text-sm text-gray-800 whitespace-pre-wrap">{localCase.Causa_Raiz_IA}</p><button onClick={generateRootCauseHandler} className="mt-3 px-3 py-1 bg-green-200 text-green-800 rounded-md hover:bg-green-300 text-xs">✨ Regenerar Análisis</button></div>)}</>)}
                    </div>)}
                    <div className="p-4 border rounded-lg bg-red-50 md:col-span-2">
                        <h4 className="text-lg font-semibold text-red-800 mb-3">Análisis de Riesgo de Escalación a SIC (IA)</h4>
                        {isGeneratingRiskAnalysis ? (<p className="text-sm text-red-700">Calculando riesgo...</p>) : (<>{(!localCase.Riesgo_SIC || !localCase.Riesgo_SIC.riesgo) ? (<button onClick={generateRiskAnalysisHandler} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm">✨ Calcular Riesgo</button>) : (<div><p className="text-base"><span className="font-bold">Nivel de Riesgo:</span><span className={`font-semibold ml-2 px-2 py-1 rounded-full ${localCase.Riesgo_SIC.riesgo === 'Bajo' ? 'bg-green-200 text-green-800' : localCase.Riesgo_SIC.riesgo === 'Medio' ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>{localCase.Riesgo_SIC.riesgo}</span></p><p className="text-sm text-gray-800 mt-2"><strong>Justificación:</strong> {localCase.Riesgo_SIC.justificacion}</p><button onClick={generateRiskAnalysisHandler} className="mt-3 px-3 py-1 bg-red-200 text-red-800 rounded-md hover:bg-red-300 text-xs">✨ Recalcular</button></div>)}</>)}
                    </div>
                </div>
                
                {/* SN ACUMULADOS */}
                <div className="mt-4 mb-6 p-4 border border-orange-200 rounded-md bg-orange-50">
                    <h4 className="text-lg font-semibold text-orange-800 mb-3">Gestión de SN Acumulados</h4>
                    <div className="mb-3"><label className="inline-flex items-center"><input type="checkbox" className="form-checkbox h-5 w-5 text-orange-600" checked={tieneSNAcumulados} onChange={(e) => { setTieneSNAcumulados(e.target.checked); if (!e.target.checked) setCantidadSNAcumulados(0); }} /><span className="ml-2 text-gray-700 font-medium">¿Tiene SN Acumulados?</span></label></div>
                    {tieneSNAcumulados && (<div className="mb-4"><label htmlFor="cantidadSNAcumulados" className="block text-sm font-medium text-gray-700 mb-1">Cantidad de SN a acumular:</label><select id="cantidadSNAcumulados" value={cantidadSNAcumulados} onChange={(e) => setCantidadSNAcumulados(Number(e.target.value))} className="block w-full max-w-xs input-form"><option value="0">Seleccione...</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></div>)}
                    {snAcumuladosData.map((item, index) => (<div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 border rounded-md bg-white"><div><label htmlFor={`sn-acumulado-${index}`} className="block text-sm font-medium text-gray-700 mb-1">SN Acumulado {index + 1}:</label><input type="text" id={`sn-acumulado-${index}`} value={item.sn} onChange={(e) => handleSNAcumuladoInputChange(index, 'sn', e.target.value)} className="block w-full input-form" placeholder="Ingrese el SN" required /></div><div><label htmlFor={`obs-acumulado-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Observaciones SN {index + 1}:</label><textarea id={`obs-acumulado-${index}`} value={item.obs} onChange={(e) => handleSNAcumuladoInputChange(index, 'obs', e.target.value)} className="block w-full input-form" rows="2" placeholder="Observaciones del SN acumulado" /></div></div>))}
                    {cantidadSNAcumulados > 0 && (<button onClick={handleSaveSNAcumulados} className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700" disabled={snAcumuladosData.some(item => !item.sn.trim())}>Guardar SN Acumulados</button>)}
                    <div className="mt-4"><h5 className="text-md font-semibold mb-2">Historial de SN Acumulados:</h5>
                        {Array.isArray(localCase.SNAcumulados_Historial) && localCase.SNAcumulados_Historial.length > 0 ? (<ul className="space-y-2 text-sm bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto border">{localCase.SNAcumulados_Historial.map((item, idx) => (<li key={idx} className="border-b pb-1 last:border-b-0"><p className="font-semibold">SN: {item.sn} <span className="font-normal text-gray-500">({new Date(item.timestamp).toLocaleString()})</span></p><p className="whitespace-pre-wrap pl-2">Obs: {item.obs}</p></li>))}</ul>) : (<p className="text-sm text-gray-500">No hay SN acumulados guardados.</p>)}
                    </div>
                </div>

                {/* ESCALAMIENTO */}
                {localCase.Estado_Gestion === 'Escalado' && (<div className="mt-4 mb-6 p-4 border border-red-200 rounded-md bg-red-50">
                    <h4 className="text-lg font-semibold text-red-800 mb-3">Detalles de Escalación</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label htmlFor="areaEscalada" className="block text-sm font-medium text-gray-700 mb-1">Área Escalada:</label><select id="areaEscalada" name="areaEscalada" value={localCase.areaEscalada || ''} onChange={(e) => handleModalFieldChange('areaEscalada', e.target.value)} className="block w-full input-form"><option value="">Seleccione Área...</option>{constants.AREAS_ESCALAMIENTO.map(area => <option key={area} value={area}>{area}</option>)}</select></div>
                        <div><label htmlFor="motivoEscalado" className="block text-sm font-medium text-gray-700 mb-1">Motivo/Acción Escalado:</label><select id="motivoEscalado" name="motivoEscalado" value={localCase.motivoEscalado || ''} onChange={(e) => handleModalFieldChange('motivoEscalado', e.target.value)} className="block w-full input-form" disabled={!localCase.areaEscalada}><option value="">Seleccione Motivo/Acción...</option>{(constants.MOTIVOS_ESCALAMIENTO_POR_AREA[localCase.areaEscalada] || []).map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}</select></div>
                        <div className="md:col-span-2">
                            <button onClick={handleSuggestEscalation} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50" disabled={isSuggestingEscalation}>✨ {isSuggestingEscalation ? 'Sugiriendo...' : 'Sugerir Escalación (IA)'}</button>
                            <button onClick={generateEscalationEmailHandler} className="ml-3 px-4 py-2 bg-teal-600 text-white rounded-md text-sm hover:bg-teal-700 disabled:opacity-50" disabled={isGeneratingEscalationEmail || !localCase.areaEscalada}>✨ {isGeneratingEscalationEmail ? 'Redactando...' : 'Redactar Correo (IA)'}</button>
                        </div>
                        <div><label htmlFor="idEscalado" className="block text-sm font-medium text-gray-700 mb-1">ID Escalado:</label><input type="text" id="idEscalado" name="idEscalado" value={localCase.idEscalado || ''} onChange={(e) => handleModalFieldChange('idEscalado', e.target.value)} className="block w-full input-form" placeholder="ID del escalamiento" /></div>
                        <div><label htmlFor="reqGenerado" className="block text-sm font-medium text-gray-700 mb-1">REQ Generado:</label><input type="text" id="reqGenerado" name="reqGenerado" value={localCase.reqGenerado || ''} onChange={(e) => handleModalFieldChange('reqGenerado', e.target.value)} className="block w-full input-form" placeholder="REQ o ticket generado" /></div>
                        <div className="md:col-span-2"><label htmlFor="descripcionEscalamiento" className="block text-sm font-medium text-gray-700 mb-1">Descripción Breve del Escalamiento:</label><textarea id="descripcionEscalamiento" name="descripcionEscalamiento" rows="3" value={localCase.descripcionEscalamiento || ''} onChange={(e) => handleModalFieldChange('descripcionEscalamiento', e.target.value)} className="block w-full input-form" placeholder="Añada una descripción del escalamiento..." /></div>
                    </div>
                    {localCase.Correo_Escalacion_IA && (<div className="mt-4"><h5 className="text-md font-semibold mb-2">Correo de Escalación (IA):</h5><div className="relative"><textarea rows="6" className="block w-full rounded-md p-2 pr-10 bg-gray-50 border" value={localCase.Correo_Escalacion_IA} readOnly /><button onClick={() => utils.copyToClipboard(localCase.Correo_Escalacion_IA, 'Correo de Escalación', displayModalMessage)} className="absolute top-1 right-1 p-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded" title="Copiar Correo">Copiar</button></div></div>)}
                    <div className="mt-4 border-t pt-4"><button onClick={handleSaveEscalamientoHistory} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Guardar Escalación</button></div>
                    <div className="mt-4"><h5 className="text-md font-semibold mb-2">Historial de Escalaciones:</h5>{Array.isArray(localCase.Escalamiento_Historial) && localCase.Escalamiento_Historial.length > 0 ? (<ul className="space-y-2 text-sm bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto border">{localCase.Escalamiento_Historial.map((item, idx) => (<li key={idx} className="border-b pb-1 last:border-b-0"><p className="font-semibold text-gray-700">Escalado: {new Date(item.timestamp).toLocaleString()}</p><p><strong>Área:</strong> {item.areaEscalada}, <strong>Motivo:</strong> {item.motivoEscalado}</p><p><strong>ID:</strong> {item.idEscalado || 'N/A'}, <strong>REQ:</strong> {item.reqGenerado || 'N/A'}</p>{item.descripcionEscalamiento && <p><strong>Desc:</strong> {item.descripcionEscalamiento}</p>}</li>))}</ul>) : (<p className="text-sm text-gray-500">No hay historial de escalación.</p>)}</div>
                </div>)}
                
                {/* ASEGURAMIENTO Y GESTIONES ADICIONALES */}
                <div className="mt-4 mb-6 p-4 border border-blue-200 rounded-md bg-blue-50">
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowGestionesAdicionales(prev => !prev)}><h4 className="text-lg font-semibold text-blue-800">Aseguramiento y Gestiones Adicionales</h4><span className="text-blue-600 font-bold text-xl">{showGestionesAdicionales ? '-' : '+'}</span></div>
                    {showGestionesAdicionales && (<div className="mt-3">
                        <div className="mb-3"><label className="inline-flex items-center"><input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600" name="Requiere_Aseguramiento_Facturas" checked={localCase.Requiere_Aseguramiento_Facturas || false} onChange={(e) => handleModalFieldChange('Requiere_Aseguramiento_Facturas', e.target.checked)} /><span className="ml-2 text-gray-700 font-medium">¿Requiere Aseguramiento Próximas Facturas?</span></label></div>
                        {localCase.Requiere_Aseguramiento_Facturas && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-5 mb-4 border-l-2 border-blue-300"><div><label htmlFor="ID_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">ID Aseguramiento:</label><input type="text" id="ID_Aseguramiento" name="ID_Aseguramiento" className="block w-full input-form" value={localCase.ID_Aseguramiento || ''} onChange={(e) => handleModalFieldChange('ID_Aseguramiento', e.target.value)} placeholder="ID" /></div><div><label htmlFor="Corte_Facturacion_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">Corte Facturación:</label><input type="text" id="Corte_Facturacion_Aseguramiento" name="Corte_Facturacion" className="block w-full input-form" value={localCase.Corte_Facturacion || ''} onChange={(e) => handleModalFieldChange('Corte_Facturacion', e.target.value)} placeholder="Ej: 15" disabled={!!localCase.ID_Aseguramiento} /></div><div><label htmlFor="Cuenta_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">Cuenta:</label><input type="text" id="Cuenta_Aseguramiento" name="Cuenta" className="block w-full input-form" value={localCase.Cuenta || ''} onChange={(e) => handleModalFieldChange('Cuenta', e.target.value)} placeholder="Número cuenta" disabled={!!localCase.ID_Aseguramiento} /></div><div><label htmlFor="Operacion_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">Operación Aseguramiento:</label><select id="Operacion_Aseguramiento" name="Operacion_Aseguramiento" value={localCase.Operacion_Aseguramiento || ''} onChange={(e) => handleModalFieldChange('Operacion_Aseguramiento', e.target.value)} className="block w-full input-form" disabled={!!localCase.ID_Aseguramiento}><option value="">Seleccione...</option>{constants.TIPOS_OPERACION_ASEGURAMIENTO.map(op => <option key={op} value={op}>{op}</option>)}</select></div><div><label htmlFor="Mes_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">Mes Aseguramiento:</label><select id="Mes_Aseguramiento" name="Mes_Aseguramiento" value={localCase.Mes_Aseguramiento || ''} onChange={(e) => handleModalFieldChange('Mes_Aseguramiento', e.target.value)} className="block w-full input-form" disabled={!!localCase.ID_Aseguramiento}><option value="">Seleccione...</option>{constants.MESES_ASEGURAMIENTO.map(mes => <option key={mes} value={mes}>{mes.charAt(0).toUpperCase() + mes.slice(1)}</option>)}</select></div><div className="md:col-span-2"><label htmlFor="Tipo_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">Tipo Aseguramiento:</label><select id="Tipo_Aseguramiento" name="Tipo_Aseguramiento" value={localCase.Tipo_Aseguramiento || ''} onChange={(e) => handleModalFieldChange('Tipo_Aseguramiento', e.target.value)} className="block w-full input-form" disabled={!!localCase.ID_Aseguramiento}><option value="">Seleccione...</option>{constants.TIPOS_ASEGURAMIENTO.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}</select></div></div>)}
                        <div className="mb-3 mt-4"><label className="inline-flex items-center"><input type="checkbox" className="form-checkbox h-5 w-5 text-red-600" name="requiereBaja" checked={localCase.requiereBaja || false} onChange={(e) => handleModalFieldChange('requiereBaja', e.target.checked)} /><span className="ml-2 text-gray-700 font-medium">¿Requiere Baja?</span></label></div>
                        {localCase.requiereBaja && (<div className="pl-5 mb-4 border-l-2 border-red-300"><label htmlFor="numeroOrdenBaja" className="block text-sm font-medium text-gray-700 mb-1">Número de Orden de Baja:</label><input type="text" id="numeroOrdenBaja" name="numeroOrdenBaja" className="block w-full input-form" value={localCase.numeroOrdenBaja || ''} onChange={(e) => handleModalFieldChange('numeroOrdenBaja', e.target.value)} placeholder="Número de Orden" /></div>)}
                        <div className="mb-3 mt-4"><label className="inline-flex items-center"><input type="checkbox" className="form-checkbox h-5 w-5 text-green-600" name="requiereAjuste" checked={localCase.requiereAjuste || false} onChange={(e) => handleModalFieldChange('requiereAjuste', e.target.checked)} /><span className="ml-2 text-gray-700 font-medium">¿Requiere Ajuste?</span></label></div>
                        {localCase.requiereAjuste && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-5 mb-4 border-l-2 border-green-300"><div><label htmlFor="numeroTT" className="block text-sm font-medium text-gray-700 mb-1">Número de TT:</label><input type="text" id="numeroTT" name="numeroTT" className="block w-full input-form" value={localCase.numeroTT || ''} onChange={(e) => handleModalFieldChange('numeroTT', e.target.value)} placeholder="Número TT" /></div><div><label htmlFor="estadoTT" className="block text-sm font-medium text-gray-700 mb-1">Estado TT:</label><select id="estadoTT" name="estadoTT" value={localCase.estadoTT || ''} onChange={(e) => handleModalFieldChange('estadoTT', e.target.value)} className="block w-full input-form"><option value="">Seleccione Estado...</option>{constants.ESTADOS_TT.map(estado => <option key={estado} value={estado}>{estado}</option>)}</select></div><div className="md:col-span-2"><label className="inline-flex items-center mt-2"><input type="checkbox" className="form-checkbox h-5 w-5 text-green-600" name="requiereDevolucionDinero" checked={localCase.requiereDevolucionDinero || false} onChange={(e) => handleModalFieldChange('requiereDevolucionDinero', e.target.checked)} disabled={!localCase.requiereAjuste} /><span className="ml-2 text-gray-700">¿Requiere Devolución Dinero?</span></label></div>{localCase.requiereDevolucionDinero && (<div className="contents"><div><label htmlFor="cantidadDevolver" className="block text-sm font-medium text-gray-700 mb-1">Cantidad a Devolver:</label><input type="number" step="0.01" id="cantidadDevolver" name="cantidadDevolver" className="block w-full input-form" value={localCase.cantidadDevolver || ''} onChange={(e) => handleModalFieldChange('cantidadDevolver', e.target.value)} placeholder="0.00" disabled={!localCase.requiereAjuste || !localCase.requiereDevolucionDinero} /></div><div><label htmlFor="idEnvioDevoluciones" className="block text-sm font-medium text-gray-700 mb-1">ID Envío Devoluciones:</label><input type="text" id="idEnvioDevoluciones" name="idEnvioDevoluciones" className="block w-full input-form" value={localCase.idEnvioDevoluciones || ''} onChange={(e) => handleModalFieldChange('idEnvioDevoluciones', e.target.value)} placeholder="ID" disabled={!localCase.requiereAjuste || !localCase.requiereDevolucionDinero} /></div><div><label htmlFor="fechaEfectivaDevolucion" className="block text-sm font-medium text-gray-700 mb-1">Fecha Efectiva Devolución:</label><input type="date" id="fechaEfectivaDevolucion" name="fechaEfectivaDevolucion" value={localCase.fechaEfectivaDevolucion || ''} onChange={(e) => handleModalFieldChange('fechaEfectivaDevolucion', e.target.value)} disabled={!localCase.requiereAjuste || !localCase.requiereDevolucionDinero} /></div></div>)}</div>)}
                        <div className="mt-4"><label htmlFor="aseguramientoObs" className="block text-sm font-medium text-gray-700 mb-1">Observaciones de la Gestión:</label><textarea id="aseguramientoObs" rows="3" className="block w-full input-form" value={aseguramientoObs} onChange={(e) => setAseguramientoObs(e.target.value)} placeholder="Añadir observaciones sobre la gestión de aseguramiento, baja o ajuste..." /></div>
                        <div className="mt-4 border-t pt-4"><label className="inline-flex items-center"><input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600" name="gestionAseguramientoCompletada" checked={localCase.gestionAseguramientoCompletada || false} onChange={(e) => handleModalFieldChange('gestionAseguramientoCompletada', e.target.checked)} /><span className="ml-2 font-medium text-gray-700">Marcar gestión de aseguramiento como completada</span></label></div>
                        <div className="mt-4 border-t pt-4"><button onClick={handleSaveAseguramientoHistory} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" disabled={!localCase.Requiere_Aseguramiento_Facturas && !localCase.requiereBaja && !localCase.requiereAjuste}>Guardar Gestión de Aseguramiento</button></div>
                        <div className="mt-4"><h5 className="text-md font-semibold mb-2">Historial de Aseguramientos:</h5>{Array.isArray(localCase.Aseguramiento_Historial) && localCase.Aseguramiento_Historial.length > 0 ? (<ul className="space-y-3 text-sm bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto border">{localCase.Aseguramiento_Historial.map((item, idx) => (<li key={idx} className="border-b pb-2 last:border-b-0"><p className="font-semibold text-gray-700">Guardado: {new Date(item.timestamp).toLocaleString()}</p>{item.Requiere_Aseguramiento_Facturas && <div><p className="font-medium text-gray-600">Aseguramiento Facturas:</p><p className="pl-2">ID: {item.ID_Aseguramiento}, Corte: {item.Corte_Facturacion}, Cuenta: {item.Cuenta}, Op: {item.Operacion_Aseguramiento}, Tipo: {item.Tipo_Aseguramiento}, Mes: {item.Mes_Aseguramiento}</p></div>}{item.requiereBaja && <div><p className="font-medium text-gray-600">Baja:</p><p className="pl-2">Orden: {item.numeroOrdenBaja}</p></div>}{item.requiereAjuste && <div><p className="font-medium text-gray-600">Ajuste:</p><p className="pl-2">TT: {item.numeroTT}, Estado: {item.estadoTT}</p></div>}{item.requiereDevolucionDinero && <div><p className="font-medium text-gray-600">Devolución:</p><p className="pl-2">Cant: ${item.cantidadDevolver}, ID Envío: {item.idEnvioDevoluciones}, Fecha: {item.fechaEfectivaDevolucion}</p></div>}{item.observaciones && <p className="mt-1"><strong>Obs:</strong> {item.observaciones}</p>}</li>))}</ul>) : (<p className="text-sm text-gray-500">No hay historial de aseguramiento.</p>)}</div>
                    </div>)}
                </div>

                {/* RELIQUIDACIÓN NOTA DE CRÉDITO */}
                <div className="mt-4 mb-6 p-4 border border-teal-200 rounded-md bg-teal-50">
                    <h4 className="text-lg font-semibold text-teal-800">Cálculo de Nota de Crédito</h4>
                    <p className="text-sm text-gray-600 mb-4">Calcula el valor a reliquidar por días no utilizados en el ciclo de facturación.</p>
                    {reliquidacionData.map((form, index) => (<div key={form.id} className="p-4 mb-4 border rounded-md bg-teal-100 relative">{reliquidacionData.length > 1 && (<button onClick={() => handleRemoveForm(form.id)} className="absolute top-2 right-2 text-gray-500 hover:text-red-700 font-bold">&times;</button>)}<h5 className="text-md font-semibold text-teal-900 mb-3">Cálculo para Cuenta #{index + 1}</h5><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor={`numeroCuenta-${form.id}`} className="block text-sm font-medium text-gray-700 mb-1">Número de Cuenta:</label><input type="text" id={`numeroCuenta-${form.id}`} name="numeroCuenta" value={form.numeroCuenta} onChange={(e) => handleReliquidacionChange(index, e)} className="block w-full input-form" /></div><div><label htmlFor={`valorMensual-${form.id}`} className="block text-sm font-medium text-gray-700 mb-1">Valor Mensual de Factura ($):</label><input type="number" id={`valorMensual-${form.id}`} name="valorMensual" value={form.valorMensual} onChange={(e) => handleReliquidacionChange(index, e)} className="block w-full input-form" /></div><div><label htmlFor={`fechaInicioCiclo-${form.id}`} className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio del Ciclo:</label><input type="date" id={`fechaInicioCiclo-${form.id}`} name="fechaInicioCiclo" value={form.fechaInicioCiclo} onChange={(e) => handleReliquidacionChange(index, e)} className="block w-full input-form" /></div><div><label htmlFor={`fechaFinCiclo-${form.id}`} className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin del Ciclo:</label><input type="date" id={`fechaFinCiclo-${form.id}`} name="fechaFinCiclo" value={form.fechaFinCiclo} onChange={(e) => handleReliquidacionChange(index, e)} className="block w-full input-form" /></div><div><label htmlFor={`fechaBaja-${form.id}`} className="block text-sm font-medium text-gray-700 mb-1">Fecha de Baja/Portación:</label><input type="date" id={`fechaBaja-${form.id}`} name="fechaBaja" value={form.fechaBaja} onChange={(e) => handleReliquidacionChange(index, e)} className="block w-full input-form" /></div></div>{form.montoNotaCredito !== null && (<div className="mt-4 p-3 bg-teal-200 rounded-md border border-teal-400"><p className="font-semibold text-teal-800">Resultado:</p><p className="text-sm">El monto de la nota de crédito para la cuenta **{form.numeroCuenta}** es de **${form.montoNotaCredito} COP**.</p></div>)}</div>))}
                    <div className="flex gap-2 mt-4"><button type="button" onClick={handleAddForm} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Añadir Cuenta</button><button type="button" onClick={calcularNotaCredito} className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700">Calcular Nota de Crédito</button></div>
                </div>

                {/* OBSERVACIONES E HISTORIAL */}
                <div className="mt-6 border-t pt-6">
                    <h4 className="text-xl font-semibold mb-4">Análisis y Observaciones</h4>
                    <div className="mb-4">
                        <label htmlFor="observations-input" className="block text-sm font-medium mb-1">Observaciones (Gestión):</label>
                        <div className="flex flex-col gap-2 mb-2">
                            <textarea id="observations-input" rows="4" className="block w-full rounded-md p-2 border" value={localCase.Observaciones || ''} onChange={handleObservationsChange} placeholder="Añade observaciones..." />
                            <div className="flex gap-2 self-end">
                                <button onClick={handleObservationFileUploadClick} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50" disabled={isTranscribingObservation}>
                                    {isTranscribingObservation ? 'Transcribiendo...' : '✨ Transcribir Adjunto'}
                                </button>
                                <button onClick={saveObservation} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Guardar Obs.</button>
                            </div>
                        </div>
                        <h5 className="text-md font-semibold mb-2">Historial Observaciones:</h5>
                        {Array.isArray(localCase.Observaciones_Historial) && localCase.Observaciones_Historial.length > 0 ? (
                            <ul className="space-y-2 text-sm bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto border">
                                {localCase.Observaciones_Historial.map((en, idx) => (<li key={idx} className="border-b pb-1 last:border-b-0"><p className="font-medium">{new Date(en.timestamp).toLocaleString()}</p><p className="whitespace-pre-wrap">{en.text}</p></li>))}
                            </ul>
                        ) : (<p className="text-sm text-gray-500">No hay historial.</p>)}
                    </div>
                </div>

                {/* RESPUESTA INTEGRAL Y VALIDACIÓN */}
                <div className="mt-6 border-t pt-6">
                    <h4 className="text-xl font-semibold mb-2">Proyección de Respuesta IA</h4>
                    <div className="relative">
                        <textarea id="proyeccionRespuestaIA" rows="8" className="block w-full rounded-md p-2 pr-10 bg-gray-50 border whitespace-pre-wrap" value={localCase.Respuesta_Integral_IA || 'No generada'} readOnly placeholder="Respuesta Integral IA aparecerá aquí..." />
                        <button onClick={() => utils.copyToClipboard(localCase.Respuesta_Integral_IA || '', 'Respuesta Integral IA', displayModalMessage)} className="absolute top-1 right-1 p-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded" title="Copiar Respuesta Integral IA">Copiar</button>
                    </div>
                    <button onClick={generateAIComprehensiveResponseHandler} className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700" disabled={isGeneratingComprehensiveResponse}>
                        ✨ {isGeneratingComprehensiveResponse ? 'Generando...' : 'Generar Respuesta Integral (IA)'}
                    </button>
                    <button onClick={() => { const textContext = utils.generateAITextContext(localCase); utils.copyToClipboard(textContext, 'Contexto para Gemini', displayModalMessage); }} className="mt-3 ml-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">
                        Copiar Contexto para Gemini
                    </button>
                </div>
                <div className="mt-6 border-t pt-6">
                    <h4 className="text-xl font-semibold mb-2">Validación de la Respuesta (IA)</h4>
                    {localCase.Validacion_IA ? (
                        <div className={`p-4 rounded-md ${localCase.Validacion_IA.completa ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'}`}>
                            <p className="font-bold">Estatus de Validación: {localCase.Validacion_IA.completa ? '✅ Completa' : '❌ Incompleta'}</p>
                            <p className="text-sm mt-2"><span className="font-semibold">Justificación:</span> {localCase.Validacion_IA.justificacion}</p>
                        </div>
                    ) : (<p className="text-sm text-gray-500">No hay validación de la IA disponible. Genere una respuesta integral primero.</p>)}
                </div>

                {/* GESTIÓN DE ESTADO */}
                <div className="mt-6 border-t pt-6">
                    <h4 className="text-xl font-semibold mb-4">Gestión del Caso</h4>
                    <div className="flex flex-wrap gap-3 mb-6">
                        {[{ l: 'Iniciado', s: 'Iniciado', cl: 'indigo' }, { l: 'Lectura', s: 'Lectura', cl: 'blue' }, 
                          { l: 'Decretado', s: 'Decretado', cl: 'purple' }, { l: 'Traslado SIC', s: 'Traslado SIC', cl: 'orange' }, 
                          { l: 'Pendiente Ajustes', s: 'Pendiente Ajustes', cl: 'pink' }, { l: 'Resuelto', s: 'Resuelto', cl: 'green' }, 
                          { l: 'Pendiente', s: 'Pendiente', cl: 'yellow' }, { l: 'Escalado', s: 'Escalado', cl: 'red' }
                        ].map(b => (
                            <button key={b.s} onClick={() => handleChangeCaseStatus(b.s)} 
                                className={`px-4 py-2 rounded-md font-semibold ${localCase.Estado_Gestion === b.s ? `bg-${b.cl}-600 text-white` : `bg-${b.cl}-200 text-${b.cl}-800 hover:bg-${b.cl}-300`} `}>
                                {b.l}
                            </button>
                        ))}
                    </div>
                    <div className="mb-4">
                        <label className="inline-flex items-center">
                            <input type="checkbox" className="form-checkbox h-5 w-5" checked={localCase.Despacho_Respuesta_Checked || false} onChange={handleDespachoRespuestaChange} />
                            <span className="ml-2 font-semibold">Despacho Respuesta</span>
                        </label>
                    </div>
                </div>

                {/* BOTONES DE CIERRE Y ACCIÓN FINAL */}
                <div className="flex justify-end mt-6 gap-4">
                    {localCase.Estado_Gestion === 'Resuelto' && (
                        <button onClick={() => { onReopenCase(localCase); onClose(); }} className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 mr-auto">Reabrir Caso</button>
                    )}
                    <button onClick={() => { onDeleteCase(localCase.id); onClose(); }} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Eliminar</button>
                    <button onClick={onClose} className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700">Cerrar</button>
                </div>
            </div>
        </div>
    );
}
