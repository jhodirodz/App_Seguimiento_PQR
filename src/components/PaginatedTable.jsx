import React, { useState } from 'react';
import { FaRegEye } from 'react-icons/fa';

const PaginatedTable = ({ cases, title, mainTableHeaders, statusColors, priorityColors, selectedCaseIds, handleSelectCase, handleOpenCaseDetails, onScanClick, nonBusinessDays, calculateCaseAge }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const casesPerPage = 10;

    const indexOfLastCase = currentPage * casesPerPage;
    const indexOfFirstCase = indexOfLastCase - casesPerPage;
    const currentCases = cases.slice(indexOfFirstCase, indexOfLastCase);
    const totalPages = Math.ceil(cases.length / casesPerPage);
    const paginate = (pageNumber) => {
        if (pageNumber < 1 || pageNumber > totalPages) return;
        setCurrentPage(pageNumber);
    };

    return (
        <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 px-2 py-1 bg-gray-200 rounded-md">{title} ({cases.length})</h3>
            <div className="overflow-x-auto rounded-lg shadow-md border">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-teal-500">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                <input
                                    type="checkbox"
                                    className="form-checkbox h-4 w-4 text-blue-600"
                                    onChange={(e) => {
                                        const newSelectedIds = new Set(selectedCaseIds);
                                        if (e.target.checked) {
                                            cases.forEach(c => newSelectedIds.add(c.id));
                                        } else {
                                            cases.forEach(c => newSelectedIds.delete(c.id));
                                        }
                                        handleSelectCase(newSelectedIds, true);
                                    }}
                                    checked={cases.length > 0 && cases.every(c => selectedCaseIds.has(c.id))}
                                    disabled={cases.length === 0}
                                />
                            </th>
                            {mainTableHeaders.map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">{h}</th>)}
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentCases.length > 0 ?
                            currentCases.map(c => (
                            <tr key={c.id} className={`hover:bg-gray-50 ${selectedCaseIds.has(c.id) ? 'bg-blue-50' : (c.Prioridad === 'Alta' ? 'bg-red-100' : '')}`}>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-4 w-4 text-blue-600"
                                        checked={selectedCaseIds.has(c.id)}
                                        onChange={() => handleSelectCase(c.id)}
                                    />
                                </td>
                                {mainTableHeaders.map(h => {
                                    let v = c[h] || 'N/A';
                                    if (h === 'Nro_Nuip_Cliente' && (!v || v === '0')) v = c.Nro_Nuip_Reclamante || 'N/A';
                                    
                                    // --- LÍNEA CLAVE AÑADIDA ---
                                    if (h === 'Dia') v = calculateCaseAge(c, nonBusinessDays);
                                    // -------------------------

                                    if (h === 'Estado_Gestion') return <td key={h} className="px-6 py-4"><span className={`px-2 inline-flex text-xs font-semibold rounded-full ${statusColors[v] || statusColors['N/A']}`}>{v}</span></td>;
                                    if (h === 'Prioridad') return <td key={h} className="px-6 py-4"><span className={`px-2 inline-flex text-xs font-semibold rounded-full ${priorityColors[v] || priorityColors['N/A']}`}>{v}</span></td>;
                                    return <td key={h} className="px-6 py-4 whitespace-nowrap text-sm">{v}</td>
                                })}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                    <button onClick={e => { e.stopPropagation(); handleOpenCaseDetails(c); }} className="text-blue-600 hover:text-blue-900">Ver Detalles</button>
                                    {c.Documento_Adjunto && String(c.Documento_Adjunto).startsWith('http') && (
                                        <a href={c.Documento_Adjunto} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ml-4 text-green-600 hover:text-green-900 font-semibold">
                                            Ver Adjunto
                                        </a>
                                    )}
                                    {c.Documento_Adjunto === "Si_Adjunto" && (
                                        <button onClick={(e) => { e.stopPropagation(); onScanClick(c); }} className="ml-4 text-green-600 hover:text-green-900 font-semibold">
                                            ✨ Escanear Adjunto
                                        </button>
                                    )}
                                </td>
                            </tr>
                            )) : <tr><td colSpan={mainTableHeaders.length + 2} className="p-6 text-center">No hay casos.</td></tr>}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <nav className="mt-4" aria-label="Pagination">
                    <ul className="flex justify-center items-center -space-x-px">
                        <li><button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-2 ml-0 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50">Anterior</button></li>
                        {[...Array(totalPages).keys()].map(number => (
                            <li key={number + 1}><button onClick={() => paginate(number + 1)} className={`px-3 py-2 leading-tight border border-gray-300 ${currentPage === number + 1 ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700' : 'text-gray-500 bg-white hover:bg-gray-100 hover:text-gray-700'}`}>{number + 1}</button></li>
                        ))}
                        <li><button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-2 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50">Siguiente</button></li>
                    </ul>
                </nav>
            )}
        </div>
    );
};
export default PaginatedTable;
