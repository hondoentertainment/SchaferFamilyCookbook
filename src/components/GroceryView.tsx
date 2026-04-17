import React, { useState, useEffect, useMemo } from 'react';
import {
  GroceryItem,
  addGroceryItems,
  clearAllGroceryItems,
  clearCheckedGroceryItems,
  getGroceryList,
  removeGroceryItem,
  toggleGroceryItem,
} from '../utils/groceryList';
import { hapticLight } from '../utils/haptics';
import { useUI } from '../context/UIContext';

interface GroceryViewProps {
  onClose?: () => void;
}

export const GroceryView: React.FC<GroceryViewProps> = ({ onClose }) => {
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<GroceryItem[]>(() => getGroceryList());
  const [newText, setNewText] = useState('');

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'schafer_grocery_list') setItems(getGroceryList());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const grouped = useMemo(() => {
    const open: GroceryItem[] = [];
    const done: GroceryItem[] = [];
    for (const i of items) (i.checked ? done : open).push(i);
    return { open, done };
  }, [items]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    setItems(addGroceryItems([text]));
    setNewText('');
    hapticLight();
  };

  const handleToggle = (id: string) => {
    hapticLight();
    setItems(toggleGroceryItem(id));
  };

  const handleRemove = (id: string) => {
    setItems(removeGroceryItem(id));
  };

  const handleClearChecked = async () => {
    if (grouped.done.length === 0) return;
    const ok = await confirm(`Remove ${grouped.done.length} checked item${grouped.done.length === 1 ? '' : 's'}?`, {
      title: 'Clear checked',
      confirmLabel: 'Clear',
    });
    if (ok) {
      setItems(clearCheckedGroceryItems());
      toast('Checked items cleared', 'success');
    }
  };

  const handleClearAll = async () => {
    if (items.length === 0) return;
    const ok = await confirm(`Remove all ${items.length} item${items.length === 1 ? '' : 's'} from your grocery list?`, {
      title: 'Clear list',
      confirmLabel: 'Clear',
    });
    if (ok) {
      setItems(clearAllGroceryItems());
      toast('Grocery list cleared', 'success');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-6 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Grocery List</p>
          <h2 className="text-4xl font-serif italic text-[#2D4635] mt-2">🛒 Family Grocery List</h2>
          <p className="text-sm text-stone-500 font-serif italic mt-1">
            {items.length === 0
              ? 'Your list is empty. Add ingredients from any recipe, or type them below.'
              : `${grouped.open.length} to get · ${grouped.done.length} checked off`}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 min-w-11 min-h-11 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"
            aria-label="Close grocery list"
          >
            ✕
          </button>
        )}
      </header>

      <form onSubmit={handleAdd} className="flex gap-2">
        <label htmlFor="grocery-add" className="sr-only">Add grocery item</label>
        <input
          id="grocery-add"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add an item (e.g. 2 lbs flour)"
          className="flex-1 p-4 border border-stone-200 rounded-2xl text-base bg-white outline-none focus:ring-2 focus:ring-[#2D4635]/20"
        />
        <button
          type="submit"
          disabled={!newText.trim()}
          className="px-6 py-4 bg-[#2D4635] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </form>

      {items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-stone-200 rounded-[2rem]">
          <p className="text-5xl mb-3">🧺</p>
          <p className="text-stone-400 font-serif italic">Nothing on the list yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.open.length > 0 && (
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-3">To Get</h3>
              <ul className="space-y-2">
                {grouped.open.map((item) => (
                  <GroceryRow key={item.id} item={item} onToggle={handleToggle} onRemove={handleRemove} />
                ))}
              </ul>
            </section>
          )}

          {grouped.done.length > 0 && (
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Checked off</h3>
              <ul className="space-y-2">
                {grouped.done.map((item) => (
                  <GroceryRow key={item.id} item={item} onToggle={handleToggle} onRemove={handleRemove} />
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap gap-3 pt-4 border-t border-stone-100">
            {grouped.done.length > 0 && (
              <button
                type="button"
                onClick={handleClearChecked}
                className="px-5 py-3 bg-stone-100 text-stone-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition-colors"
              >
                Clear checked ({grouped.done.length})
              </button>
            )}
            <button
              type="button"
              onClick={handleClearAll}
              className="px-5 py-3 bg-white border border-stone-200 text-stone-500 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-stone-50 transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const GroceryRow: React.FC<{
  item: GroceryItem;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}> = ({ item, onToggle, onRemove }) => {
  return (
    <li className="flex items-center gap-3 bg-white border border-stone-100 rounded-2xl px-4 py-3 min-h-[3rem]">
      <label className="flex items-center gap-3 flex-1 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => onToggle(item.id)}
          className="w-5 h-5 accent-[#2D4635]"
          aria-label={`Mark ${item.text} as ${item.checked ? 'not purchased' : 'purchased'}`}
        />
        <div className="min-w-0">
          <span className={`font-serif text-base ${item.checked ? 'line-through text-stone-400' : 'text-stone-800'}`}>
            {item.text}
          </span>
          {item.recipeTitle && (
            <span className="block text-[10px] uppercase tracking-widest text-stone-400 mt-0.5">
              from {item.recipeTitle}
            </span>
          )}
        </div>
      </label>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="w-10 h-10 min-w-11 min-h-11 flex items-center justify-center rounded-full text-stone-300 hover:text-stone-600 hover:bg-stone-100 transition-colors"
        aria-label={`Remove ${item.text}`}
        title="Remove"
      >
        ✕
      </button>
    </li>
  );
};
