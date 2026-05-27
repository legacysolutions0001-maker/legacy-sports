import * as React from "react";
import { useListSports, useUpsertSport, useDeleteSport, getListSportsQueryKey } from "@workspace/api-client-react";
import type { SportConfig, SportField } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ActivitySquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

function FieldEditor({ fields, onChange }: { fields: SportField[]; onChange: (f: SportField[]) => void }) {
  const addField = () => {
    onChange([...fields, { key: `field_${Date.now()}`, label: "", type: "int" }]);
  };
  const removeField = (i: number) => onChange(fields.filter((_, fi) => fi !== i));
  const updateField = (i: number, patch: Partial<SportField>) => {
    const updated = [...fields];
    updated[i] = { ...updated[i]!, ...patch };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Stat Fields</p>
        <Button type="button" size="sm" variant="outline" onClick={addField} data-testid="button-add-field"><Plus className="h-3 w-3 mr-1" />Add</Button>
      </div>
      {fields.map((f, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 items-end">
          <div>
            <label className="text-xs">Label</label>
            <Input className="h-8 text-sm" value={f.label} onChange={(e) => updateField(i, { label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })} />
          </div>
          <div>
            <label className="text-xs">Section</label>
            <Input className="h-8 text-sm" placeholder="optional" value={f.section ?? ""} onChange={(e) => updateField(i, { section: e.target.value })} />
          </div>
          <div>
            <label className="text-xs">Type</label>
            <Select value={f.type} onValueChange={(v) => updateField(i, { type: v as SportField["type"] })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="int">Integer</SelectItem>
                <SelectItem value="float">Decimal</SelectItem>
                <SelectItem value="text">Text</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeField(i)} data-testid={`button-remove-field-${i}`}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function SportForm({ sport, onClose }: { sport?: SportConfig; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const upsert = useUpsertSport();
  const [name, setName] = React.useState(sport?.sportName ?? "");
  const [icon, setIcon] = React.useState(sport?.icon ?? "trophy");
  const [fields, setFields] = React.useState<SportField[]>(sport?.fieldsJson ?? []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: "Sport name required", variant: "destructive" }); return; }
    try {
      await upsert.mutateAsync({ data: { sportName: name.trim(), icon, fields } });
      toast({ title: sport ? "Sport updated" : "Sport created" });
      qc.invalidateQueries({ queryKey: getListSportsQueryKey() });
      onClose();
    } catch (e: any) {
      toast({ title: "Failed", description: e.response?.data?.error, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Sport Name</label>
          <Input data-testid="input-sport-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cricket" className="mt-1" disabled={!!sport} />
        </div>
        <div>
          <label className="text-sm font-medium">Icon (Lucide name)</label>
          <Input data-testid="input-sport-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="trophy" className="mt-1" />
        </div>
      </div>
      <FieldEditor fields={fields} onChange={setFields} />
      <Button type="submit" className="w-full" disabled={upsert.isPending} data-testid="button-save-sport">
        {sport ? "Update Sport" : "Create Sport"}
      </Button>
    </form>
  );
}

export default function Sports() {
  const { data: sports, isLoading } = useListSports();
  const qc = useQueryClient();
  const { toast } = useToast();
  const deleteSport = useDeleteSport();
  const [editSport, setEditSport] = React.useState<SportConfig | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const handleDelete = async (id: number) => {
    try {
      await deleteSport.mutateAsync({ id });
      toast({ title: "Sport deleted" });
      qc.invalidateQueries({ queryKey: getListSportsQueryKey() });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sport Configurations</h1>
          <p className="text-muted-foreground">Manage sport types and stat tracking fields</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-sport"><Plus className="h-4 w-4 mr-2" />Add Sport</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Sport</DialogTitle></DialogHeader>
            <SportForm onClose={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : sports?.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ActivitySquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No sports configured yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sports?.map((s) => (
            <Card key={s.id} data-testid={`card-sport-${s.id}`}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{s.sportName}</h3>
                  <div className="flex gap-1">
                    <Dialog open={editSport?.id === s.id} onOpenChange={(o) => !o && setEditSport(null)}>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditSport(s)} data-testid={`button-edit-sport-${s.id}`}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Edit Sport</DialogTitle></DialogHeader>
                        {editSport && <SportForm sport={editSport} onClose={() => setEditSport(null)} />}
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" data-testid={`button-delete-sport-${s.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {s.sportName}?</AlertDialogTitle>
                          <AlertDialogDescription>This will remove the sport configuration.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {s.fieldsJson?.slice(0, 5).map((f) => (
                    <Badge key={f.key} variant="outline" className="text-xs">{f.label}</Badge>
                  ))}
                  {(s.fieldsJson?.length ?? 0) > 5 && <Badge variant="outline" className="text-xs">+{(s.fieldsJson?.length ?? 0) - 5} more</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
