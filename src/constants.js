// src/constants.js

export const ALL_PRIORITY_OPTIONS = ['Alta', 'Media', 'Baja'];
export const ALL_STATUS_OPTIONS = ['Pendiente', 'Iniciado', 'Lectura', 'Resuelto', 'Finalizado', 'Escalado', 'Decretado', 'Traslado SIC', 'Pendiente Ajustes'];
export const priorityColors = {
  'Alta': 'bg-red-100 text-red-800',
  'Media': 'bg-yellow-100 text-yellow-800',
  'Baja': 'bg-green-100 text-green-800',
  'Critica': 'bg-red-700 text-white',
  'N/A': 'bg-gray-100 text-gray-800'
};

export const statusColors = {
  'Pendiente': 'bg-yellow-100 text-yellow-800',
  'Iniciado': 'bg-blue-100 text-blue-800',
  'Lectura': 'bg-indigo-100 text-indigo-800',
  'Resuelto': 'bg-green-100 text-green-800',
  'Finalizado': 'bg-gray-200 text-gray-600',
  'Escalado': 'bg-red-100 text-red-800',
  'Decretado': 'bg-purple-100 text-purple-800',
  'Traslado SIC': 'bg-orange-100 text-orange-800',
  'Pendiente Ajustes': 'bg-pink-100 text-pink-800',
  'N/A': 'bg-gray-100 text-gray-800'
};
export const MAIN_TABLE_HEADERS = [
    'SN',
    'CUN',
    'Fecha Radicado',
    'Dia',
    'Fecha Vencimiento',
    'Nombre_Cliente',
    'Nro_Nuip_Cliente',
    'Tipo_Contrato',
    'Categoria del reclamo',
    'Prioridad',
    'Estado_Gestion'
];

export const MODAL_DISPLAY_HEADERS = [
    'SN', 'CUN', 'Fecha Radicado', 'Fecha Cierre', 'fecha_asignacion', 'user',
    'Estado_Gestion', 'Fecha_Inicio_Gestion', 'Tiempo_Resolucion_Minutos',
    'Radicado_SIC', 'Fecha_Vencimiento_Decreto', 'Dia', 'Fecha Vencimiento',
    'Tipo_Contrato', 'Numero_Contrato_Marco', 'isNabis', 'Nombre_Cliente', 'Nro_Nuip_Cliente', 'Correo_Electronico_Cliente',
    'Direccion_Cliente', 'Ciudad_Cliente', 'Depto_Cliente', 'Nombre_Reclamante',
    'Nro_Nuip_Reclamante', 'Correo_Electronico_Reclamante', 'Direccion_Reclamante',
    'Ciudad_Reclamante', 'Depto_Reclamante', 'HandleNumber', 'AcceptStaffNo',
    'type_request', 'obs', 'Numero_Reclamo_Relacionado',
    'nombre_oficina', 'Tipopago', 'date_add', 'Tipo_Operacion',
    'Prioridad', 'Analisis de la IA', 'Categoria del reclamo', 'Resumen_Hechos_IA', 'Documento_Adjunto',
    'Respuesta_Integral_IA'
];

export const TIPOS_OPERACION_ASEGURAMIENTO = ["Aseguramiento FS", "Aseguramiento TELCO", "Aseguramiento SINTEL", "Aseguramiento D@VOX"];
export const TIPOS_ASEGURAMIENTO = [
    "Eliminar cobros facturados (paz y salvo)", "Ajustes to invoice de cartera", "Aprobación envío SMS",
    "Aseguramiento clientes reconectados", "Aseguramiento FS - No cobro RX - RXM", "Calidad de impresión",
    "Cambio de localidad FS", "Carga a tablas FS", "NO Cobros gastos de cobranza",
    "Generar reconexión FS", "Solicitud ajustes cartera", "Validacion inconsistencias / Aplicar DTO",
    "Validación cambio de suscriptor", "Ajustar cobros por aceleración Baseport", "Confirmar BAJA del servicio",
    "Recepción factura electronica", "Recepción factura fisica", "No cobros plataforma Streaming"
];
export const MESES_ASEGURAMIENTO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const ESTADOS_TT = ["Pendiente", "Aplicado"];

export const MOTIVOS_ESCALAMIENTO_POR_AREA = {
    "Voz del cliente Individual": [
        "Datos Movil - No navega - No tiene equipo para pruebas", "Datos Movil - No navega - Problemas Red", "Datos Movil - No navega - Problemas Cobertura", "Datos Movil - No navega - Inconveniente Atipico-Requiere Pruebas", "Datos Movil - No navega - Conciliacion - Cierre de ciclo", "Datos Movil - No navega - Conciliacion Plataformas HLR-DPI-TI", "Datos Movil - No navega - Escalamiento tecnico abierto excede SLA", "Datos Movil - No navega - Falla en Bonos - Altamira",
        "Datos Movil - Intermitencia - No tiene equipo para pruebas", "Datos Movil - Intermitencia - Problemas Red", "Datos Movil - Intermitencia - Problemas Cobertura", "Datos Movil - Intermitencia - Inconveniente Atipico-Requiere Pruebas", "Datos Movil - Intermitencia - Conciliacion - Cierre de ciclo", "Datos Movil - Intermitencia - Conciliacion Plataformas HLR-DPI-TI", "Datos Movil - Intermitencia - Escalamiento tecnico abierto excede SLA",
        "Datos Movil - Lentitud - No tiene equipo para pruebas", "Datos Movil - Lentitud - Problemas Red", "Datos Movil - Lentitud - Problemas Cobertura", "Datos Movil - Lentitud - Inconveniente Atipico-Requiere Pruebas", "Datos Movil - Lentitud - Conciliacion - Cierre de ciclo", "Datos Movil - Lentitud - Conciliacion Plataformas HLR-DPI-TI", "Datos Movil - Lentitud - Escalamiento tecnico abierto excede SLA",
    ],
    "Recaudo": [
        "Pagos Tienda Movistar - Aplicacion de pago", "Pagos Tienda Movistar - Devolucion de saldo Entidad financiera", "Pagos Tienda Movistar - Devolucion de saldo Tesoreria",
        "Pagos irregulares - Rehabilitacion pagos irregulares medios electronicos", "Recepcion pagos entidades - No aceptacion de pagos a clientes",
        "Titulos valores devueltos - Rehabilitacion linea por devoluciones cheque", "Titulos valores devueltos - Solicitud envio titulo valor",
        "Recargas no efectivas por pago - Solicitud validacion recarga no efectiva con pago", "Carta de pago - Solicitud certificacion de pagos",
        "Inconformidad con pagos - Pago no aplicado", "Inconformidad con pagos - Correccion de pago", "Inconformidad con pagos - Venta cuota correccion de pago", "Inconformidad con pagos - Devolucion de cheque", "Inconformidad con pagos - Pago automatico no aplicado",
    ],
    "Reno Repo": [
        "Activacion reno-repo - Activacion equipo y-o sim para ingreso DOA o PNC",
        "Solicitudes envio equipos y simcard - Solicitud para aprobacion con subsidio por ONE", "Solicitudes envio equipos y simcard - Solicitudes envio equipos y simcard por fallas en Rn",
        "Reclamos reno-repo - Inconsistencias cambio de plan inmediato Reno Rep", "Reclamos reno-repo - Pedidos sin estado de envio", "Reclamos reno-repo - Reclamacion cambio de plan numeral 654 CE", "Reclamos reno-repo - Reclamacion por cobro errado reno-repo a domicilio",
        "Decreto 587 - Solicitud recogida de equipos RenoRepo",
    ],
    "Roaming - Movil": [
        "R - No tiene linea alterna de contacto", "R - Problemas Red", "R - Problemas Cobertura", "R - Inconveniente Atipico-Requiere Pruebas", "R - Conciliacion - Cierre de ciclo", "R - Conciliacion Plataformas HLR-DPI-TI", "R - Escalamiento tecnico abierto excede SLA",
    ],
    "Ajustes": [
        "Ajuste no reflejado en sistema - Explicacion no aplicacion de ajuste",
        "Devolucion de dinero - Cliente no puede reclamar dinero", "Devolucion de dinero - Devolucion dinero no disponible y-o vigente", "Devolucion de dinero - Solicitud soportes transferencia de dinero", "Devolucion de dinero - Explicacion motivo No Procedente",
    ],
    "Ventas tienda movistar": [
        "Reclamos tienda movistar - Reclamo por obsequio no entregado", "Reclamos tienda movistar - Devolucion de saldo", "Reclamos tienda movistar - Linea no activa", "Reclamos tienda movistar - Pago no aplicado tienda Movistar",
        "Informacion contenidos Reno Repo Tienda Movistar", "Fallas precios y planes Reno Repo",
        "Logistica de entrega de equipos - Solicitud de reenvio de equipo",
        "Reclamos tienda movistar interno - Aplicacion de pagos CE", "Reclamos tienda movistar interno - Diferencia en pago", "Reclamos tienda movistar interno - Ventas sin codigo de cliente",
    ],
    "Movistar TU - Play": [
        "Errores de Activacion", "Devolucion dinero", "Informacion comercial de productos y oferta", "Valores del plan no coinciden con oferta", "Direcciones no creadas no georeferenciadas",
    ],
    "Consultas cobertura": ["Solicitud de cobertura voz y datos", "Inconvenientes cobertura voz y datos"],
    "Centrales de riesgo": ["Modificar", "Eliminar", "Pago voluntario", "Pago al dia"],
    "Retencion": ["Movil", "Fija", "Solicitud de Baja no realizada"],
    "Facturacion": [
        "Factura no llega", "Requerimientos especiais - Fecha de vencimientos especiais", "Requerimientos especiais - Cambio de categoria tributaria",
        "Solicitudes STP - Equipos con seguro movil", "Solicitudes STP - Modificaciones de ordenes", "Solicitudes STP - Solicitud de grabacion llamadas fuera de garantia", "Solicitudes STP - traslado equipo apertura bandas (nokia)", "Solicitudes STP - solicitud devolucion equipo abandonado", "Solicitudes STP - Notificar equipo traido", "Solicitudes STP - Gestion novedad ticket Logytech- seg Empresas", "Solicitudes STP - Solicitud de brigada - seg Empresas",
    ],
    "Riesgo operacional": [
        "Pago irregular", "Peticiones en Gestion Fraude - Reconsideracion Peticiones en Gestion Fraude", "Seriales bajo causal fraude",
        "Desmarcacion Clientes Reventa - Estudio Desmarcacion Clientes Reventa", "Prevalidacion Riesgo Crediticio - Prevalidacion nits Riesgo crediticio",
        "Sistema de Verificacion Clientes - Inclusion antecedentes de riesgo operacional", "Sistema de Verificacion Clientes - Revalidacion antecedentes riesgo operacional",
        "Retiro de SVC - Solicitud retiro serie de negativos", "Contingencia rehabilitacion equipo perdido robo - Contingencia rehabilitacion equipo indispo BES",
        "Suspension terminal - Solicitud retiro series de negativos", "Suspension terminal - Contingencia rehabilitacion equipo indispo BES", "Suspension terminal - Suspension Terminal",
        "Hurto de terminales", "Otras solicitudes fraude - Pago irregular", "Otras solicitudes fraude - Seriales bajo causal fraude",
    ],
    "Logistica Comercial": [
        "Ajuste de Inventario - Solicitud Informacion Regularizacion Series", "Solicitud Regularizacion en SAP Series Corporativos",
        "Entrega solicitud actualizacion - Accesorios faltantes", "Entrega solicitud actualizacion - Despiece simcard", "Entrega solicitud actualizacion - Error activacion simcard movil", "Entrega solicitud actualizacion - Explicacion modificacion cancelacion de pedido", "Entrega solicitud actualizacion - Incumplimiento tiempo de entrega", "Entrega solicitud actualizacion - Pedido entregado en forma errada", "Entrega solicitud actualizacion - Reagendamiento por venta a domicilio", "Entrega solicitud actualizacion - Entrega Kit auto instalacion",
        "Devolucion de celulares, accesorios y baterias", "Reversiones de Ventas - Inconsistencias reversion", "Reversiones de Ventas - Solicitud reversion de venta", "Reversiones de Ventas - Reversion del servicio Provisional",
    ],
    "Gestion y soporte": [
        "Revision inconsistencias solicitudes", "Activacion o desactivacion de servicios a corte", "Cambio de plan pos pre a corte", "Inclusiones al corte inclusion hii",
        "Modificaciones cliente road track a corte", "Otros requerimientos a corte", "Traspasos a corte", "Activacion bonos o beneficios inmediato",
        "Activacion o desactivacion de servicios inmediato", "Anulaciones de baja", "Bajas inmediato - Req autorizacion fidelizacion",
        "Cambios de plan a prepago inmediato", "Cargue de incidencias masivas", "Envio de mensajes institucionales", "Otros requerimientos inmediatos",
        "Requerimientos masivos GST - EQ - SC", "Traspasos inmediato - Req autorizacion jefe", "Tribus inmediato", "Alta y baja de svas cargues masivos",
    ],
    "Activaciones": [
        "Solicitud Cambio de Sim", "Solicitud Reno Repo", "Solicitud activacion de servicios M2M", "Cta bloqueado por intentos permitidos en Evidente", "Fallas proceso activacion prepago", "Soporte Portabilidad", "Proceso 728 No Realizado o Errado",
    ],
    "Planes con restriccion": [
        "Reclamaciones STP - Cobros errados por STP", "Reclamaciones STP - Equipos trocados en STP", "Reclamaciones STP - Reclamacion faltante de accesorios", "Reclamaciones STP - Reclamaciones por reingresos", "Reclamaciones STP - Equipo llega sin diagnostico y-o fotos",
    ],
    "Cartera": [
        "Solicitud de Rehabilitacion", "Inmunidades - Ingreso", "Inmunidades - Retiro", "Listas Negras", "Listas Rojas",
        "Inconsistencias Pre-post", "Acuerdos de pago Corporativo", "Venta de Cartera", "Estados de Cuenta Corporativo", "Pqr Masivo", "Ajustes Masivos",
    ],
    "Voz del Cliente Pyme": ["Facturacion", "Falla de servicios", "Solicitud Comercial Posventa"],
    "Riesgo Crediticio": [
        "Excepciones Venta Cuotas - Venta", "Excepciones Venta Cuotas - Pos-Venta", "Excepciones de Credito - Venta - Excepcion del Cupo",
    ],
    "Legalizaciones": [
        "Objecion Ventas Sin Legalizar", "Objecion Novedades Reportadas en la Legalizacion", "Solicitud Documentacion Digital PQR", "Usuario Bloqueado por Ventas Sin Legalizar",
        "Solicitud Documentacion Digital MSC", "Objecion Legalizacion Biometrics", "Asesor Bloqueado Herramientas de Activacion",
    ],
    "Televentas": ["Cambio de plan de Prepago a Pospago Televentas"],
    "Voz del Cliente Empresas": ["Facturacion", "Falla de servicios", "Solicitud Comercial Posventa"],
    "Modificacion pedidos en vuelo": [
        "Cambio de plan BA FMC en terreno", "Cambio de plan BA en terreno", "Decos de mas en terreno", "Decos de menos en terreno", "Baja de SVA", "Cambio de oferta FMC en terreno",
    ],
};
export const AREAS_ESCALAMIENTO = Object.keys(MOTIVOS_ESCALAMIENTO_POR_AREA);
// Feriados oficiales de Colombia (2025–2026)
export const COLOMBIAN_HOLIDAYS = [
  // === 2025 ===
  "2025-01-01", // Año Nuevo
  "2025-01-06", // Reyes Magos
  "2025-03-24", // San José
  "2025-04-17", // Jueves Santo
  "2025-04-18", // Viernes Santo
  "2025-05-01", // Día del Trabajo
  "2025-05-26", // Ascensión del Señor
  "2025-06-16", // Corpus Christi
  "2025-06-23", // Sagrado Corazón
  "2025-07-20", // Independencia de Colombia
  "2025-08-07", // Batalla de Boyacá
  "2025-08-18", // La Asunción de la Virgen
  "2025-10-13", // Día de la Raza
  "2025-11-03", // Todos los Santos
  "2025-11-17", // Independencia de Cartagena
  "2025-12-08", // Inmaculada Concepción
  "2025-12-25", // Navidad

  // === 2026 ===
  "2026-01-01", // Año Nuevo
  "2026-01-12", // Reyes Magos (trasladado)
  "2026-03-23", // San José
  "2026-04-02", // Jueves Santo
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajo
  "2026-05-18", // Ascensión del Señor
  "2026-06-08", // Corpus Christi
  "2026-06-15", // Sagrado Corazón
  "2026-07-20", // Independencia de Colombia
  "2026-08-07", // Batalla de Boyacá
  "2026-08-17", // La Asunción de la Virgen (trasladado)
  "2026-10-12", // Día de la Raza
  "2026-11-02", // Todos los Santos (trasladado)
  "2026-11-16", // Independencia de Cartagena (trasladado)
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25"  // Navidad
];
