// src/constants.js

export const ALL_PRIORITY_OPTIONS = ['Alta', 'Media', 'Baja', 'N/A'];
export const ALL_STATUS_OPTIONS = ['Pendiente', 'Resuelto', 'Finalizado', 'Escalado', 'Iniciado', 'Lectura', 'Decretado', 'Traslado SIC', 'Pendiente Ajustes'];

export const MAIN_TABLE_HEADERS = [
  { id: 'SN', name: 'SN' },
  { id: 'CUN', name: 'CUN' },
  { id: 'Estado_Gestion', name: 'Estado' },
  { id: 'Dia', name: 'Días' },
  { id: 'Prioridad', name: 'Prioridad' },
  { id: 'Categoria del reclamo', name: 'Categoría IA' },
  { id: 'fecha_asignacion', name: 'Asignado' }
];

export const AREAS_ESCALAMIENTO = [
  'Área de Facturación',
  'Área Técnica',
  'Área Comercial',
  'Atención al Cliente'
];

export const MOTIVOS_ESCALAMIENTO_POR_AREA = {
  'Área de Facturación': ['Revisión de cuenta', 'Ajuste de cargos', 'Problemas de pago'],
  'Área Técnica': ['Falla de servicio', 'Configuración', 'Desconexión'],
  'Área Comercial': ['Renovación de contrato', 'Cambio de plan', 'Ofertas'],
  'Atención al Cliente': ['Queja general', 'Sugerencia', 'Agradecimiento']
};

export const ESTADOS_TT = [
  'Abierto',
  'En Proceso',
  'Aplicado',
  'Cerrado',
  'Cancelado'
];

export const TIPOS_OPERACION_ASEGURAMIENTO = [
  'Ajuste',
  'Facturación',
  'Recuperación'
];

export const MESES_ASEGURAMIENTO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const TIPOS_ASEGURAMIENTO = [
  'Por Solicitud',
  'Por Proceso',
  'Por Sistema'
];

export const COLOMBIAN_HOLIDAYS = [
    '2025-01-01', '2025-01-06', '2025-03-24', '2025-03-25', '2025-05-01',
    '2025-06-02', '2025-06-23', '2025-06-30', '2025-07-20', '2025-08-07',
    '2025-08-18', '2025-10-13', '2025-11-03', '2025-11-11', '2025-12-08',
    '2025-12-25'
];
