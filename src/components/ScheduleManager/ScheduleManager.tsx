import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, X, Check, Save } from 'lucide-react'

interface BackupSchedule {
    id: string
    name: string
    frequency: 'daily' | 'weekly'
    time: string
    days: number[]
    sourceIds: string[]
    destinationId: string
    enabled: boolean
    lastRun: string | null
}

interface ScheduleManagerProps {
    isOpen: boolean
    onClose: () => void
    sources: { id: string; name: string }[]
    destinations: { id: string; name: string }[]
}

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mer' },
    { value: 4, label: 'Jeu' },
    { value: 5, label: 'Ven' },
    { value: 6, label: 'Sam' },
    { value: 0, label: 'Dim' },
]

export default function ScheduleManager({ isOpen, onClose, sources, destinations }: ScheduleManagerProps) {
    const [schedules, setSchedules] = useState<BackupSchedule[]>([])
    const [editingSchedule, setEditingSchedule] = useState<Partial<BackupSchedule> | null>(null)

    useEffect(() => {
        if (isOpen && window.electronAPI) {
            loadSchedules()
        }
    }, [isOpen])

    const loadSchedules = async () => {
        try {
            const loaded = await window.electronAPI.scheduler.getSchedules()
            setSchedules(loaded)
        } catch (error) {
            toast.error("Erreur lors du chargement des tâches")
        }
    }

    const handleSave = async () => {
        if (!editingSchedule || !editingSchedule.name || !editingSchedule.destinationId || !editingSchedule.sourceIds?.length) {
            toast.error("Veuillez remplir tous les champs obligatoires")
            return
        }

        const scheduleToSave: BackupSchedule = {
            id: editingSchedule.id || Date.now().toString(),
            name: editingSchedule.name,
            frequency: editingSchedule.frequency || 'daily',
            time: editingSchedule.time || '12:00',
            days: editingSchedule.days || [],
            sourceIds: editingSchedule.sourceIds,
            destinationId: editingSchedule.destinationId,
            enabled: editingSchedule.enabled ?? true,
            lastRun: editingSchedule.lastRun || null
        }

        try {
            if (editingSchedule.id) {
                await window.electronAPI.scheduler.updateSchedule(scheduleToSave)
                toast.success("Tâche mise à jour")
            } else {
                await window.electronAPI.scheduler.addSchedule(scheduleToSave)
                toast.success("Tâche créée")
            }
            setEditingSchedule(null)
            loadSchedules()
        } catch (error) {
            toast.error("Erreur lors de la sauvegarde")
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await window.electronAPI.scheduler.removeSchedule(id)
            toast.success("Tâche supprimée")
            loadSchedules()
        } catch (error) {
            toast.error("Erreur lors de la suppression")
        }
    }

    const toggleDay = (day: number) => {
        if (!editingSchedule) return
        const currentDays = editingSchedule.days || []
        const newDays = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day]
        setEditingSchedule({ ...editingSchedule, days: newDays })
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-900 border border-dark-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-dark-800">
                    <h2 className="text-xl font-semibold text-white">Tâches Planifiées</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {!editingSchedule ? (
                        <>
                            {schedules.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    Aucune tâche planifiée.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {schedules.map(schedule => (
                                        <div key={schedule.id} className="bg-dark-800 rounded-lg p-4 flex items-center justify-between border border-dark-700">
                                            <div>
                                                <h3 className="font-medium text-white">{schedule.name}</h3>
                                                <p className="text-sm text-gray-400">
                                                    {schedule.frequency === 'daily' ? 'Tous les jours' : 'Chaque semaine'} à {schedule.time}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {sources.filter(s => schedule.sourceIds.includes(s.id)).length} source(s) vers {destinations.find(d => d.id === schedule.destinationId)?.name || 'Destination inconnue'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setEditingSchedule(schedule)}
                                                    className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(schedule.id)}
                                                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={() => setEditingSchedule({
                                    frequency: 'daily',
                                    days: [],
                                    sourceIds: [],
                                    enabled: true
                                })}
                                className="w-full py-3 border-2 border-dashed border-dark-700 rounded-lg text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={20} />
                                Nouvelle tâche
                            </button>
                        </>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Nom</label>
                                    <input
                                        type="text"
                                        value={editingSchedule.name || ''}
                                        onChange={e => setEditingSchedule({ ...editingSchedule, name: e.target.value })}
                                        className="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                        placeholder="Ex: Backup NAS Soir"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Heure</label>
                                    <input
                                        type="time"
                                        value={editingSchedule.time || ''}
                                        onChange={e => setEditingSchedule({ ...editingSchedule, time: e.target.value })}
                                        className="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Fréquence</label>
                                    <select
                                        value={editingSchedule.frequency || 'daily'}
                                        onChange={e => setEditingSchedule({ ...editingSchedule, frequency: e.target.value as 'daily' | 'weekly' })}
                                        className="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="daily">Quotidien</option>
                                        <option value="weekly">Hebdomadaire</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Destination</label>
                                    <select
                                        value={editingSchedule.destinationId || ''}
                                        onChange={e => setEditingSchedule({ ...editingSchedule, destinationId: e.target.value })}
                                        className="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="">Choisir...</option>
                                        {destinations.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {editingSchedule.frequency === 'weekly' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Jours</label>
                                    <div className="flex gap-2">
                                        {DAYS_OF_WEEK.map(day => (
                                            <button
                                                key={day.value}
                                                onClick={() => toggleDay(day.value)}
                                                className={`
                                                    w-10 h-10 rounded-lg text-sm font-medium transition-colors
                                                    ${(editingSchedule.days || []).includes(day.value)
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-dark-800 text-gray-400 hover:bg-dark-700'}
                                                `}
                                            >
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Sources à sauvegarder</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 bg-dark-950/50 rounded-lg p-3 border border-dark-800">
                                    {sources.map(source => (
                                        <label key={source.id} className="flex items-center gap-3 p-2 hover:bg-dark-800 rounded cursor-pointer group">
                                            <div className={`
                                                w-5 h-5 rounded border flex items-center justify-center transition-colors
                                                ${(editingSchedule.sourceIds || []).includes(source.id)
                                                    ? 'bg-blue-600 border-blue-600'
                                                    : 'border-dark-600 group-hover:border-dark-500'}
                                            `}>
                                                {(editingSchedule.sourceIds || []).includes(source.id) && <Check size={14} className="text-white" />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={(editingSchedule.sourceIds || []).includes(source.id)}
                                                onChange={() => {
                                                    const current = editingSchedule.sourceIds || []
                                                    const newIds = current.includes(source.id)
                                                        ? current.filter(id => id !== source.id)
                                                        : [...current, source.id]
                                                    setEditingSchedule({ ...editingSchedule, sourceIds: newIds })
                                                }}
                                            />
                                            <span className="text-gray-300">{source.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-dark-800 mt-6">
                                <button
                                    onClick={() => setEditingSchedule(null)}
                                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
                                >
                                    <Save size={18} />
                                    Sauvegarder
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
