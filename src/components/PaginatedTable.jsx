// src/components/PaginatedTable.jsx
import React, { useState } from 'react';
import { FaRegEye } from 'react-icons/fa';

const PaginatedTable = ({ cases, title, mainTableHeaders, statusColors, priorityColors, selectedCaseIds, handleSelectCase, handleOpenCaseDetails, calculateCaseAge, nonBusinessDays }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const casesPerPage = 10;
    const totalPages = Math.ceil(cases.length / casesPerPage);
    const indexOfLastCase = currentPage * casesPerPage;
    const indexOfFirstCase = indexOfLastCase - casesPerPage;
    const currentCases = cases.slice(indexOfFirstCase, indexOfLastCase);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h2 className="text-xl font-bold mb-4">{title} ({cases.length})</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <input
                                    type="checkbox"
                                    onChange={(e) => handleSelectCase(e.target.checked ? new Set(cases.map(c => c.id)) : new Set(), true)}
                                    checked={selectedCaseIds.size === cases.length && cases.length > 0}
                                />
                            </th>
                            {mainTableHeaders.map(header => (
                                <th key={header.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {header.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentCases.length > 0 ? (
                            currentCases.map((caseItem) => (
                                <tr key={caseItem.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={selectedCaseIds.has(caseItem.id)}
                                            onChange={() => handleSelectCase(caseItem.id, false)}
                                        />
                                    </td>
                                    {mainTableHeaders.map(header => (
                                        <td key={header.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {header.id === 'Estado_Gestion' && (
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[caseItem[header.id]] || 'bg-gray-200 text-gray-800'}`}>
                                                    {caseItem[header.id]}
                                                </span>
                                            )}
                                            {header.id === 'Prioridad' && (
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${priorityColors[caseItem[header.id]] || 'bg-gray-400 text-white'}`}>
                                                    {caseItem[header.id]}
                                                </span>
                                            )}
                                            {header.id === 'Dia' && (
                                                <span>{calculateCaseAge(caseItem, nonBusinessDays)}</span>
                                            )}
                                            {header.id !== 'Estado_Gestion' && header.id !== 'Prioridad' && header.id !== 'Dia' && (
                                                <span>{caseItem[header.id] || 'N/A'}</span>
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleOpenCaseDetails(caseItem)} className="text-indigo-600 hover:text-indigo-900">
                                            <FaRegEye className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={mainTableHeaders.length + 1} className="px-6 py-4 text-center text-gray-500">
                                    No hay casos para mostrar.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="py-2 flex justify-center space-x-2">
                {Array.from({ length: totalPages }, (_, i) => (
                    <button
                        key={i}
                        onClick={() => paginate(i + 1)}
                        className={`px-4 py-2 text-sm font-medium rounded-md ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        {i + 1}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default PaginatedTable;
