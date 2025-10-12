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
    '2025-01-01', '2025-01-06', '2025-03-24', '2025-03-20', '2025-03-21', '2025-05-01', '2025-05-26',
    '2025-06-16', '2025-06-23', '2025-06-30', '2025-07-20', '2025-08-07', '2025-08-18', '2025-10-13',
    '2025-11-03', '2025-11-17', '2025-12-08', '2025-12-25','2026-01-01', '2026-01-12',   '2026-03-23',   '2026-04-02',  '2026-04-03', '2026-05-01', '2026-05-18',   '2026-06-08',   '2026-06-15',   '2026-06-29',   '2026-07-20',   '2026-08-07',  '2026-08-17',  '2026-10-12',   '2026-11-02',  '2026-11-16',   '2026-12-08',   '2026-12-25',
];

