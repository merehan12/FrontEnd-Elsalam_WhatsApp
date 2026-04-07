import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchComments,
  createComment,
  editComment,
  deleteComment,
  selectTimelineState,
} from "../../store/slices/timelineSlice";

export default function CommentsModal({
  open,
  onClose,
  customerId, // ✅ customerId only
  meId,
  isAdmin,
}) {
  const dispatch = useDispatch();

  const safeCustomerId = customerId != null ? String(customerId) : null;
  const tl = useSelector((s) => selectTimelineState(s, safeCustomerId));

  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // ✅ fetch comments when modal opens / customer changes
  useEffect(() => {
    if (!open) return;
    if (!safeCustomerId) return;
    dispatch(fetchComments({ customerId: safeCustomerId }));
  }, [open, safeCustomerId, dispatch]);

  const canSubmit = useMemo(() => {
    return Boolean(safeCustomerId) && newComment.trim().length > 0;
  }, [safeCustomerId, newComment]);

  const onCreate = async () => {
    if (!canSubmit) return;

    const text = newComment.trim();
    setNewComment("");

    await dispatch(
      createComment({
        customerId: safeCustomerId,
        content: text,
        comment_type: "internal",
        visibility: "staff",
      })
    );

    dispatch(fetchComments({ customerId: safeCustomerId }));
  };

  const onSaveEdit = async (commentId) => {
    const text = editText.trim();
    if (!text) return;

    await dispatch(editComment({ commentId, content: text }));

    setEditingId(null);
    setEditText("");

    if (safeCustomerId) dispatch(fetchComments({ customerId: safeCustomerId }));
  };

  const onDelete = async (commentId) => {
    await dispatch(deleteComment({ commentId }));
    setDeletingId(null);

    if (safeCustomerId) dispatch(fetchComments({ customerId: safeCustomerId }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative z-50 w-[min(700px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl border border-gray-200/70 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-200/70 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Comments
          </h3>
          <button
            className="px-2 py-1 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {!safeCustomerId && (
            <div className="text-sm text-red-600 dark:text-red-400">
              customerId is undefined (Chats.jsx لازم يمرر customerId صحيح)
            </div>
          )}

          {tl?.loading && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Loading...
            </div>
          )}

          {tl?.error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {String(tl.error)}
            </div>
          )}

          {(tl?.comments || []).map((c) => {
            const canEdit = String(c?.author?.id || "") === String(meId);
            const canDelete = Boolean(isAdmin);
            const created = c?.timestamp || c?.created_at || c?.createdAt;

            return (
              <div
                key={c.id}
                className="p-3 rounded-xl border border-gray-200/70 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-full">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {c.author?.username || c.author?.name || "Unknown"} •{" "}
                      <span className="opacity-80">
                        {created ? new Date(created).toLocaleString() : ""}
                      </span>
                    </div>

                    {editingId === c.id ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="mt-2 w-full min-h-[80px] rounded-lg border bg-gray-50 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 p-2"
                      />
                    ) : (
                      <div className="mt-1 text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                        {c.content}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {editingId === c.id ? (
                      <>
                        <button
                          className="px-2 py-1 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 hover:opacity-90"
                          onClick={() => {
                            setEditingId(null);
                            setEditText("");
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="px-2 py-1 rounded-lg text-sm bg-[#952D8C] text-white hover:opacity-90 disabled:opacity-60"
                          disabled={!editText.trim()}
                          onClick={() => onSaveEdit(c.id)}
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        {canEdit && (
                          <button
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                            onClick={() => {
                              setEditingId(c.id);
                              setEditText(c.content || "");
                            }}
                            title="Edit comment"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400"
                            onClick={() => setDeletingId(c.id)}
                            title="Delete comment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {deletingId === c.id && (
                  <div className="mt-3 p-3 rounded-lg border border-red-200/60 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
                    <span>Are you sure you want to delete this comment?</span>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700"
                        onClick={() => setDeletingId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700"
                        onClick={() => onDelete(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {(tl?.comments || []).length === 0 && !tl?.loading && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              No comments yet
            </div>
          )}
        </div>

        {/* Add new */}
        <div className="p-4 border-t border-gray-200/70 dark:border-gray-700 bg-white dark:bg-gray-900">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write an internal note..."
            className="w-full min-h-[96px] rounded-xl border bg-gray-50 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 p-3 outline-none focus:ring-2 focus:ring-[#952D8C]/60"
          />
          <div className="mt-3 flex items-center justify-end">
            <button
              disabled={!canSubmit}
              onClick={onCreate}
              className="px-4 py-2 rounded-xl bg-[#952D8C] text-white hover:opacity-90 disabled:opacity-60"
            >
              Add comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
