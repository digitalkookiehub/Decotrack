import { useRef, useState } from "react";
import { Upload, Download, FileSpreadsheet, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import api from "../../services/api";

interface BulkActionsProps {
  entityType: "vendors" | "materials";
  selectedIds: number[];
  onImportComplete: () => void;
  onDeleteComplete: () => void;
}

export function BulkActions({ entityType, selectedIds, onImportComplete, onDeleteComplete }: BulkActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExport = () => {
    const url = `/api/v1/bulk/${entityType}/export`;
    const token = localStorage.getItem("access_token");
    // Use fetch to download with auth
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${entityType}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(`${entityType}.xlsx downloaded`);
      })
      .catch(() => toast.error("Export failed"));
  };

  const handleTemplate = () => {
    const url = `/api/v1/bulk/${entityType}/template`;
    const token = localStorage.getItem("access_token");
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${entityType}_template.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("Template downloaded");
      })
      .catch(() => toast.error("Download failed"));
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post(`/bulk/${entityType}/import`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(res.data);
      setShowResult(true);
      onImportComplete();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Import failed";
      toast.error(msg);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.post(`/bulk/${entityType}/delete`, { ids: selectedIds });
      toast.success(`${res.data.deleted} ${entityType} deactivated`);
      setShowDeleteConfirm(false);
      onDeleteComplete();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* Export */}
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Download className="h-4 w-4 mr-1" />
        Export Excel
      </Button>

      {/* Template */}
      <Button variant="outline" size="sm" onClick={handleTemplate}>
        <FileSpreadsheet className="h-4 w-4 mr-1" />
        Template
      </Button>

      {/* Import */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
        <Upload className="h-4 w-4 mr-1" />
        {importing ? "Importing..." : "Import Excel"}
      </Button>

      {/* Bulk Delete */}
      {selectedIds.length > 0 && (
        <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
          <Trash2 className="h-4 w-4 mr-1" />
          Delete ({selectedIds.length})
        </Button>
      )}

      {/* Import Result Dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Complete</DialogTitle>
            <DialogDescription>Results of the Excel import</DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{importResult.created}</p>
                  <p className="text-xs text-green-600">Created</p>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{importResult.updated}</p>
                  <p className="text-xs text-blue-600">Updated</p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm font-medium text-red-700 mb-1">Errors ({importResult.errors.length})</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResult.errors.map((err, idx) => (
                      <p key={idx} className="text-xs text-red-600">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowResult(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {selectedIds.length} {entityType}? This can be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? "Deleting..." : `Delete ${selectedIds.length} ${entityType}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
