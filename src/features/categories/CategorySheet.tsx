import { useState } from 'preact/hooks'
import { categories, createCategory, expenses, recurring, removeCategory, saveCategory } from '../../data/store'
import { closeSheet } from '../../ui/nav'
import type { SheetRequest } from '../../ui/nav'
import { Button, ConfirmButton, Switch, TextField } from '../../ui/components/controls'
import { Sheet } from '../../ui/components/Sheet'
import { toast } from '../../ui/components/toast'
import { canDeleteCategory, checkCategoryName, isCategoryInUse } from '../settings/settingsModel'
import './category-sheet.css'

/** Rendered by SheetHost while `sheet.value.type === 'category'`. No id = new category. */
interface CategorySheetProps {
  request: Extract<SheetRequest, { type: 'category' }>
}

export function CategorySheet({ request }: CategorySheetProps) {
  const existing = request.id ? categories.value.find((c) => c.id === request.id) : undefined
  const editing = request.id !== undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [archived, setArchived] = useState(existing?.archived ?? false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (editing && !existing) {
    return (
      <Sheet open title="Kategori" onClose={closeSheet}>
        <p class="category-sheet-text">Bu kategori bulunamadı. Liste yenilenmiş olabilir.</p>
      </Sheet>
    )
  }

  const inUse = existing ? isCategoryInUse(existing.id, expenses.value, recurring.value) : false
  const deletable = existing ? canDeleteCategory(existing, inUse) : false

  async function save(e?: Event) {
    e?.preventDefault()
    if (busy) return
    const check = checkCategoryName(name, categories.value, existing?.id)
    if (!check.ok) {
      setNameError(check.error)
      return
    }
    setNameError(null)
    setBusy(true)
    try {
      if (existing) {
        await saveCategory({ ...existing, name: check.name, archived })
        toast('Kategori kaydedildi')
      } else {
        await createCategory(check.name)
        toast('Kategori eklendi')
      }
      closeSheet()
    } catch {
      toast('Kategori kaydedilemedi. Tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!existing) return
    try {
      await removeCategory(existing.id)
      toast('Kategori silindi')
      closeSheet()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kategori silinemedi.')
    }
  }

  return (
    <Sheet
      open
      title={existing ? 'Kategoriyi düzenle' : 'Kategori ekle'}
      onClose={closeSheet}
      footer={
        <Button variant="primary" block disabled={busy} onClick={() => save()}>
          Kaydet
        </Button>
      }
    >
      <form class="category-sheet-form" onSubmit={save}>
        <TextField
          label="Ad"
          value={name}
          placeholder="Örn. Hobi"
          onChange={(v) => {
            setName(v)
            setNameError(null)
          }}
          error={nameError}
          hint={nameError ? undefined : '1–24 karakter. Aynı adda ikinci kategori olamaz.'}
        />

        {existing && (
          <Switch
            label="Arşivle"
            checked={archived}
            onChange={setArchived}
            hint="Arşivdeki kategori harcama eklerken seçilmez. Geçmiş kayıtlar yerinde kalır."
          />
        )}

        {existing && existing.builtin && <p class="category-sheet-text">Yerleşik kategoriler silinemez; arşivleyebilirsin.</p>}

        {existing && !existing.builtin && (
          <div class="category-sheet-danger">
            {deletable ? (
              <ConfirmButton label="Kategoriyi sil" confirmLabel="Emin misin? Tekrar dokun" onConfirm={remove} />
            ) : (
              <p class="category-sheet-text">Bu kategoriyle kayıtlı harcamalar var; arşivleyebilirsin.</p>
            )}
          </div>
        )}
      </form>
    </Sheet>
  )
}
