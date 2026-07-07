"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useDocuments, useCreateDocument, useDeleteDocument } from "@/hooks/use-documents";
import { useNotificationStore } from "@/stores/use-notification-store";
import { FileText, Plus, Search, Trash2, LogOut, User as UserIcon, Calendar, ArrowRight, Shield } from "lucide-react";

interface DashboardContentProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function DashboardContent({ user }: DashboardContentProps) {
  const router = useRouter();
  const { addToast } = useNotificationStore();
  const [search, setSearch] = useState("");

  // Queries & Mutations
  const { data, isLoading, error } = useDocuments(search);
  const createDocumentMutation = useCreateDocument();
  const deleteDocumentMutation = useDeleteDocument();

  const handleCreateDocument = async () => {
    try {
      const newDoc = await createDocumentMutation.mutateAsync({
        title: "Untitled Document",
        content: "",
      });
      addToast("success", "Document created successfully");
      router.push(`/documents/${newDoc.id}`);
    } catch (err) {
      addToast("error", "Failed to create document");
    }
  };

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering route navigation to document
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await deleteDocumentMutation.mutateAsync(id);
      addToast("success", "Document deleted successfully");
    } catch (err) {
      addToast("error", "Failed to delete document");
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Dashboard Top Header Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-indigo-500/20 shadow-lg">
              D
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:inline">CollabDocs</span>
          </div>

          {/* User Profile and Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-full border border-slate-800 text-sm">
              <UserIcon className="w-4 h-4 text-indigo-400" />
              <span className="font-medium max-w-[120px] truncate">{user.name || user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-slate-200 transition-colors duration-150 rounded-lg hover:bg-slate-900"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Workspace
            </h1>
            <p className="mt-1 text-slate-400 text-sm">
              Manage and collaborate on your local-first documents.
            </p>
          </div>

          <button
            onClick={handleCreateDocument}
            disabled={createDocumentMutation.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/10 transition-all duration-150"
          >
            <Plus className="w-4 h-4" />
            New Document
          </button>
        </div>

        {/* Search Bar Input */}
        <div className="relative mb-6 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="h-5 w-5" />
          </span>
          <input
            type="text"
            placeholder="Search documents by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-lg border border-slate-800 bg-slate-900/40 py-2.5 pl-10 pr-3 text-slate-200 placeholder-slate-500 transition-colors duration-150 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
          />
        </div>

        {/* Documents Grid / States */}
        {isLoading ? (
          /* Loading Skeleton Skeletons Grid */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-44 border border-slate-800/80 bg-slate-900/20 rounded-xl p-5 space-y-4 animate-pulse"
              >
                <div className="h-6 w-2/3 bg-slate-800 rounded" />
                <div className="h-4 w-1/3 bg-slate-800 rounded" />
                <div className="flex items-center justify-between pt-4">
                  <div className="h-7 w-20 bg-slate-800 rounded-full" />
                  <div className="h-8 w-8 bg-slate-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error Boundary View */
          <div className="flex flex-col items-center justify-center border border-slate-800/80 bg-slate-900/10 rounded-2xl p-12 text-center">
            <span className="text-rose-400 font-semibold mb-2">Failed to load workspace documents</span>
            <p className="text-slate-400 text-sm mb-4">Please verify your connection and try reloading.</p>
          </div>
        ) : !data || data.documents.length === 0 ? (
          /* Empty State View */
          <div className="flex flex-col items-center justify-center border border-slate-800/80 border-dashed bg-slate-900/10 rounded-2xl py-16 px-6 text-center">
            <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No documents found</h3>
            <p className="text-slate-400 text-sm max-w-sm mb-6 leading-relaxed">
              {search
                ? "No matches found. Try editing your search terms."
                : "Create a collaborative, offline-first document to get started."}
            </p>
            {!search && (
              <button
                onClick={handleCreateDocument}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white px-4 py-2.5 shadow-lg"
              >
                Create Document
              </button>
            )}
          </div>
        ) : (
          /* Documents Grid List */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.documents.map((doc: any) => (
              <div
                key={doc.id}
                onClick={() => router.push(`/documents/${doc.id}`)}
                className="group relative flex flex-col justify-between border border-slate-800/80 bg-slate-900/20 hover:bg-slate-900/40 hover:border-slate-700/80 rounded-xl p-5 shadow-sm transition-all duration-150 cursor-pointer"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {doc.title}
                    </h3>
                    <ArrowRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Updated {new Date(doc.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-900/60">
                  {/* Role Badge */}
                  <div className="flex items-center gap-1 px-2.5 py-0.5 bg-slate-950 rounded-full border border-slate-800 text-[10px] font-semibold tracking-wide text-slate-300">
                    <Shield className="w-3 h-3 text-indigo-400" />
                    <span className="capitalize">{doc.role.toLowerCase()}</span>
                  </div>

                  {/* Delete Button (Only active for OWNER role) */}
                  {doc.role === "OWNER" && (
                    <button
                      onClick={(e) => handleDeleteDocument(doc.id, e)}
                      disabled={deleteDocumentMutation.isPending}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150"
                      title="Delete Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
