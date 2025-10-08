"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const createFormSchema = (rawMaterials: RawMaterial[]) =>
  z.object({
    code: z.string().min(1, "Batch code is required"),
    date: z.date({
      required_error: "Please select a date",
    }),
    description: z.string().optional(),
    finishedGoodId: z.string().min(1, "Please select a finished good"),
    materials: z
      .array(
        z.object({
          rawMaterialId: z.string().min(1, "Please select a raw material"),
          quantity: z.coerce
            .number({
              required_error: "Quantity is required",
              invalid_type_error: "Quantity must be a number",
            })
            .refine(
              (val) => !isNaN(val) && val > 0,
              "Quantity must be greater than zero"
            ),
        })
      )
      .min(1, "At least one raw material is required")
      .refine((materials) => {
        const materialIds = materials
          .map((m) => m.rawMaterialId)
          .filter((id) => id !== "");
        return materialIds.length === new Set(materialIds).size;
      }, "Cannot select the same raw material multiple times")
      .refine(
        (materials) => {
          return materials.every((material) => {
            if (!material.rawMaterialId) return true;
            const rawMaterial = rawMaterials.find(
              (rm) => rm.id === material.rawMaterialId
            );
            return rawMaterial
              ? material.quantity <= rawMaterial.currentStock
              : true;
          });
        },
        {
          message: "One or more quantities exceed available stock",
          path: [],
        }
      ),
  });

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

interface RawMaterial {
  id: string;
  name: string;
  kode: string;
  currentStock: number;
}

interface FinishedGood {
  id: string;
  name: string;
  sku: string;
}

interface AddBatchDialogProps {
  onSuccess: () => void;
}

export function AddBatchDialog({ onSuccess }: AddBatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([]);

  const formSchema = createFormSchema(rawMaterials);
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      date: new Date(),
      description: "",
      finishedGoodId: "",
      materials: [{ rawMaterialId: "", quantity: "" as unknown as number }],
    },
    mode: "onSubmit",
  });

  // Update form validation when rawMaterials change
  useEffect(() => {
    if (rawMaterials.length > 0) {
      form.clearErrors();
    }
  }, [rawMaterials, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "materials",
  });

  const fetchData = async () => {
    try {
      const [rawMaterialsRes, finishedGoodsRes] = await Promise.all([
        fetch("/api/raw-materials"),
        fetch("/api/finished-goods"),
      ]);

      if (!rawMaterialsRes.ok || !finishedGoodsRes.ok) {
        throw new Error("Failed to fetch required data");
      }

      const rawMaterialsData = await rawMaterialsRes.json();
      // Handle both array response and paginated response
      const rawMats = Array.isArray(rawMaterialsData) ? rawMaterialsData : (rawMaterialsData.data || []);
      setRawMaterials(rawMats);

      const finishedGoodsData = await finishedGoodsRes.json();
      // Handle both array response and paginated response
      const finishedGoods = Array.isArray(finishedGoodsData) ? finishedGoodsData : (finishedGoodsData.data || []);
      setFinishedGoods(finishedGoods);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load required data. Please try again.");
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          date: data.date.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to create batch");
      }

      toast.success("Batch created successfully");
      form.reset();
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error("Error creating batch:", error);
      const message =
        error instanceof Error ? error.message : "Failed to create batch";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  const addMaterial = () => {
    append({ rawMaterialId: "", quantity: "" as unknown as number });
  };

  const removeMaterial = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Catat Pemakaian Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catat Pemakaian Baru</DialogTitle>
          <DialogDescription>
            Record a new production batch with multiple raw materials and
            finished good output.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter batch code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Raw Materials Used</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-4 items-end">
                    <FormField
                      control={form.control}
                      name={`materials.${index}.rawMaterialId`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Raw Material</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full [&>span]:truncate">
                                <SelectValue placeholder="Select raw material" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {rawMaterials.filter((m) => m.currentStock > 0)
                                .length === 0 ? (
                                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                  No raw materials with stock available
                                </div>
                              ) : (
                                <>
                                  {rawMaterials
                                    .filter((m) => m.currentStock > 0)
                                    .map((material) => (
                                      <SelectItem
                                        key={material.id}
                                        value={material.id}
                                      >
                                        <div className="flex items-center gap-2 max-w-[400px]">
                                          <span className="truncate">
                                            {material.kode} - {material.name}
                                          </span>
                                          <span className="text-green-600 font-medium whitespace-nowrap shrink-0">
                                            (Stock: {material.currentStock.toLocaleString()})
                                          </span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  {rawMaterials.filter(
                                    (m) => m.currentStock === 0
                                  ).length > 0 && (
                                    <>
                                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t">
                                        Out of Stock
                                      </div>
                                      {rawMaterials
                                        .filter((m) => m.currentStock === 0)
                                        .map((material) => (
                                          <SelectItem
                                            key={material.id}
                                            value={material.id}
                                            disabled
                                          >
                                            <div className="flex items-center gap-2 max-w-[400px]">
                                              <span className="truncate">
                                                {material.kode} - {material.name}
                                              </span>
                                              <span className="text-destructive whitespace-nowrap shrink-0">
                                                (Out of Stock)
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                    </>
                                  )}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`materials.${index}.quantity`}
                      render={({ field }) => {
                        const selectedMaterialId = form.watch(
                          `materials.${index}.rawMaterialId`
                        );
                        const selectedMaterial = rawMaterials.find(
                          (m) => m.id === selectedMaterialId
                        );
                        const availableStock =
                          selectedMaterial?.currentStock || 0;

                        return (
                          <FormItem className="w-40">
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0"
                                {...field}
                              />
                            </FormControl>
                            {selectedMaterial && (
                              <p className="text-xs text-muted-foreground">
                                Available: {availableStock.toLocaleString()}
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeMaterial(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addMaterial}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Material
                </Button>
              </CardContent>
            </Card>

            <FormField
              control={form.control}
              name="finishedGoodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Finished Good</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full [&>span]:truncate">
                        <SelectValue placeholder="Select finished good" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {finishedGoods.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="truncate max-w-[400px]">
                            {product.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Batch"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
