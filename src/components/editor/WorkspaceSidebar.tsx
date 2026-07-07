"use client";

import React, { useState } from "react";
import {
  useShareDocument,
  useRevokePermission,
  useSnapshots,
  useRestoreSnapshot,
} from "@/hooks/use-documents";
import { useNotificationStore } from "@/stores/use-notification-store";
import { computeWordDiff, DiffToken } from "@/lib/crdt/diff";
import {
  Users,
  History,
  UserPlus,
  Trash2,
  GitCommit,
  RotateCcw,
  Eye,
  X,
  FileDiff,
  Loader2,
  Clock,
} from "lucide-react";
import { UserRole } from "@/types";

interface WorkspaceSidebarProps {
  documentId: string;
  currentUserId: string;
  role: UserRole;
  currentContent: string;
  permissions: Array<{
    userId: string;
    email: string | null;
    name: string | null;
    role: UserRole;
  }>;
}

export default function WorkspaceSidebar({
  documentId,
  currentUserId,
  role,
  currentContent,
  permissions,
}: WorkspaceSidebarProps) {
  const { addToast } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<"sharing" | "history">("sharing");

  // Sharing States
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<UserRole>("EDITOR");

  // History States
  const [filterManualOnly, setFilterManualOnly] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);
  const [diffTokens, setDiffTokens] = useState<DiffToken[] | null>(null);

  // Queries & Mutations
  const { data: snapshotsData, isLoading: loadingSnapshots } = useSnapshots(documentId);
  const shareMutation = useShareDocument(documentId);
  const revokeMutation = useRevokePermission(documentId);
  const restoreMutation = useRestoreSnapshot(documentId);

  // 1. Handle share form submission
  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareEmail) {
      addToast("warning", "Please provide a valid email");
      return;
    }

    try {
      await shareMutation.mutateAsync({ email: shareEmail, role: shareRole });
      addToast("success", `Document successfully shared with ${shareEmail}`);
      setShareEmail("");
    } catch (err: any) {
      addToast("error", err.message || "Failed to share document");
    }
  };

  // 2. Handle revoking permissions
  const handleRevoke = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke permissions for ${email}?`)) return;

    try {
      await revokeMutation.mutateAsync(userId);
      addToast("success", `Revoked permissions for ${email}`);
    } catch (err: any) {
      addToast("error", err.message || "Failed to revoke permissions");
    }
  };

  // 3. Compute differences for the selected snapshot
  const handleViewDiff = (snapshot: any) => {
    try {
      const tokens = computeWordDiff(snapshot.content || "", currentContent);
      setSelectedSnapshot(snapshot);
      setDiffTokens(tokens);
    } catch (err) {
      addToast("error", "Failed to calculate version differences");
    }
  };

  // 4. Trigger snapshot restoration
  const handleRestore = async (snapshotId: string, versionNumber: number) => {
    if (!confirm(`Are you sure you want to roll back the document to Version ${versionNumber}?`)) return;

    try {
      await restoreMutation.mutateAsync(snapshotId);
      addToast("success", `Document successfully rolled back to Version ${versionNumber}`);
      setSelectedSnapshot(null);
      setDiffTokens(null);
    } catch (err: any) {
      addToast("error", err.message || "Failed to restore snapshot");
    }
  };

  const filteredSnapshots = snapshotsData
    ? snapshotsData.filter((s: any) => !filterManualOnly || s.isManual)
    : [];

  return (
    <div className="w-80 border-l border-slate-800 bg-slate-900/60 backdrop-blur-xl flex flex-col h-full text-slate-200">
      {/* Sidebar Tabs Header */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab("sharing")}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === "sharing"
              ? "border-indigo-500 text-indigo-400 bg-slate-800/20"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/10"
          }`}
        >
          <Users className="w-4 h-4" />
          Sharing
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === "history"
              ? "border-indigo-500 text-indigo-400 bg-slate-800/20"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/10"
          }`}
        >
          <History className="w-4 h-4" />
          History
        </button>
      </div>

      {/* Tabs Content Panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === "sharing" ? (
          /* SHARING TAB CONTENT */
          <>
            {/* Share Form (Only for Owner) */}
            {role === "OWNER" ? (
              <form onSubmit={handleShare} className="space-y-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                  Share Document
                </h3>
                <div className="space-y-2">
                  <input
                    type="email"
                    required
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="User email address..."
                    className="block w-full rounded bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={shareRole}
                      onChange={(e) => setShareRole(e.target.value as UserRole)}
                      className="flex-1 rounded bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="EDITOR">Editor (Can edit)</option>
                      <option value="VIEWER">Viewer (Read-only)</option>
                    </select>
                    <button
                      type="submit"
                      disabled={shareMutation.isPending}
                      className="rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                    >
                      {shareMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Invite"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="p-3 bg-slate-950/20 rounded-xl border border-slate-800/40 text-center text-xs text-slate-500">
                Only document owners can configure share permissions.
              </div>
            )}

            {/* List of Permissions Users */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Collaborators ({permissions.length})
              </h3>
              <div className="space-y-2">
                {permissions.map((collab) => (
                  <div
                    key={collab.userId}
                    className="flex items-center justify-between p-2.5 bg-slate-950/30 rounded-lg border border-slate-800/80 gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">
                        {collab.name || "Pending Account"}
                      </p>
                      <p className="text-slate-500 truncate text-[10px]">
                        {collab.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-semibold text-slate-400 uppercase">
                        {collab.role}
                      </span>
                      {role === "OWNER" && collab.userId !== currentUserId && (
                        <button
                          onClick={() => handleRevoke(collab.userId, collab.email || "User")}
                          disabled={revokeMutation.isPending}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Revoke Permission"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* HISTORY TAB CONTENT */
          <>
            {/* Filters */}
            <div className="flex items-center justify-between p-2 bg-slate-950/40 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">Show manual snapshots only</span>
              <input
                type="checkbox"
                checked={filterManualOnly}
                onChange={(e) => setFilterManualOnly(e.target.checked)}
                className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            {/* Snapshots Timeline Log */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Snapshots Timeline
              </h3>

              {loadingSnapshots ? (
                <div className="space-y-2 py-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-slate-900/30 border border-slate-800 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : filteredSnapshots.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No snapshots recorded for this document.
                </div>
              ) : (
                <div className="relative border-l border-slate-800 pl-4 ml-2 space-y-4">
                  {filteredSnapshots.map((snap: any) => (
                    <div key={snap.id} className="relative group space-y-1.5">
                      {/* Timeline dot marker */}
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-slate-800 bg-slate-950 group-hover:bg-indigo-500 transition-colors" />

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-white">
                            Version {snap.versionNumber}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(snap.createdAt).toLocaleDateString()} at {new Date(snap.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[9px] font-semibold text-slate-400">
                          {snap.isManual ? "Manual" : "Auto"}
                        </span>
                      </div>

                      {/* Version Actions Panel */}
                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={() => handleViewDiff(snap)}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold rounded transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          Compare
                        </button>
                        {role === "OWNER" && (
                          <button
                            onClick={() => handleRestore(snap.id, snap.versionNumber)}
                            disabled={restoreMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/20 text-indigo-400 text-[10px] font-semibold rounded transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* VERSION DIFF PREVIEW MODAL */}
      {selectedSnapshot && diffTokens && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl flex flex-col max-h-[85vh] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <div className="flex items-center gap-2">
                <FileDiff className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-lg text-white">
                  Comparing Current Content with Version {selectedSnapshot.versionNumber}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedSnapshot(null);
                  setDiffTokens(null);
                }}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Diff Comparison Legend */}
            <div className="flex gap-4 px-4 py-2 border-b border-slate-800 bg-slate-950/40 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-rose-500/20 border border-rose-500/35 rounded" />
                <span className="text-slate-400">Removed in historical snapshot</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-emerald-500/20 border border-emerald-500/35 rounded" />
                <span className="text-slate-400">Added in current document</span>
              </div>
            </div>

            {/* Tokenized Content Preview Container */}
            <div className="flex-1 overflow-y-auto p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap select-text">
              {diffTokens.length === 0 ? (
                <div className="text-slate-500 text-center py-12 italic">
                  Both versions have identical text content.
                </div>
              ) : (
                diffTokens.map((token, index) => {
                  if (token.type === "added") {
                    return (
                      <span
                        key={index}
                        className="bg-emerald-500/20 border-b-2 border-emerald-500/30 text-emerald-200 px-1 py-0.5 rounded"
                      >
                        {token.value}
                      </span>
                    );
                  }
                  if (token.type === "removed") {
                    return (
                      <span
                        key={index}
                        className="bg-rose-500/20 border-b-2 border-rose-500/30 text-rose-300 px-1 py-0.5 rounded line-through"
                      >
                        {token.value}
                      </span>
                    );
                  }
                  return <span key={index} className="text-slate-300">{token.value}</span>;
                })
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="border-t border-slate-800 p-4 flex justify-end gap-3 bg-slate-950/20">
              <button
                onClick={() => {
                  setSelectedSnapshot(null);
                  setDiffTokens(null);
                }}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-sm font-semibold rounded-lg transition-colors border border-slate-800"
              >
                Close Comparison
              </button>
              {role === "OWNER" && (
                <button
                  onClick={() => handleRestore(selectedSnapshot.id, selectedSnapshot.versionNumber)}
                  disabled={restoreMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore this version
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
