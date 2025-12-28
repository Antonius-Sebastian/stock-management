"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const createFormSchema = (items: Item[], type: "in" | "out" | "IN" | "OUT") =>
  z
    .object({
      itemId: z.string().min(1, "Please select an item"),
      quantity: z.coerce
        .number({
          required_error: "Quantity is required",
          invalid_type_error: "Quantity must be a number",
        })
        .refine(
          (val) => !isNaN(val) && val > 0,
          "Quantity must be greater than zero"
        ),
      date: z.date({
        required_error: "Please select a date",
      }),
      description: z.string().optional(),
    })
    .refine(
      (data) => {
        const normalizedType =
          typeof type === "string" ? type.toUpperCase() : type;
        if (normalizedType === "OUT") {
          const selectedItem = items.find((item) => item.id === data.itemId);
          if (selectedItem && "currentStock" in selectedItem) {
            return (
              data.quantity <=
              (selectedItem as Item & { currentStock: number }).currentStock
            );
          }
        }
        return true;
      },
      {
        message: "Quantity cannot exceed available stock",
        path: ["quantity"],
      }
    );

interface StockEntryDialogProps {
  type: "in" | "out" | "IN" | "OUT";
  itemType?: "raw-material" | "finished-good";
  entityType?: "raw-material" | "finished-good";
  entityId?: string;
  entityName?: string;
  onSuccess: () => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface Item {
  id: string;
  name: string;
  kode?: string;
  sku?: string;
  currentStock?: number;
}

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

export function StockEntryDialog({
  type,
  itemType,
  entityType,
  entityId,
  entityName,
  onSuccess,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: StockEntryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  // Use controlled or uncontrolled state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen =
    controlledOnOpenChange !== undefined
      ? controlledOnOpenChange
      : setInternalOpen;

  // Determine the actual item type to use
  const actualItemType = entityType || itemType || "raw-material";

  const formSchema = createFormSchema(items, type);
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      itemId: entityId || "",
      quantity: "" as unknown as number,
      date: new Date(),
      description: "",
    },
    mode: "onSubmit",
  });

  const fetchItems = async (signal?: AbortSignal) => {
    try {
      const endpoint =
        actualItemType === "raw-material"
          ? "/api/raw-materials"
          : "/api/finished-goods";
      const response = await fetch(endpoint, { signal });
      if (!response.ok) {
        throw new Error("Failed to fetch items");
      }
      const data = await response.json();
      // Handle both array response and paginated response
      const items = Array.isArray(data) ? data : data.data || [];
      setItems(items);
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Error fetching items:", error);
      toast.error("Failed to load items. Please try again.");
    }
  };

  useEffect(() => {
    // Create AbortController for cleanup
    const controller = new AbortController();

    if (open) {
      fetchItems(controller.signal);
    }

    // Cleanup function to abort fetch on unmount or dependency change
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actualItemType]);

  // Update form when entityId changes
  useEffect(() => {
    if (entityId && open) {
      form.setValue("itemId", entityId);
    }
  }, [entityId, open, form]);

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      const normalizedType =
        typeof type === "string" ? type.toUpperCase() : type;
      const stockMovementData = {
        type: normalizedType,
        quantity: data.quantity,
        date: data.date.toISOString(),
        description: data.description,
        ...(actualItemType === "raw-material"
          ? { rawMaterialId: data.itemId }
          : { finishedGoodId: data.itemId }),
      };

      const response = await fetch("/api/stock-movements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stockMovementData),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to create stock movement");
      }

      const actionType = normalizedType === "IN" ? "incoming" : "outgoing";
      const itemTypeLabel =
        actualItemType === "raw-material" ? "raw material" : "finished good";

      toast.success(
        `Successfully recorded ${actionType} stock for ${itemTypeLabel}`
      );
      form.reset();
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error("Error creating stock movement:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create stock movement";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  const getTitle = () => {
    const normalizedType = typeof type === "string" ? type.toUpperCase() : type;
    const action =
      normalizedType === "IN" ? "Input Stok Masuk" : "Input Stok Keluar";
    const itemTypeLabel =
      actualItemType === "raw-material" ? "Raw Material" : "Finished Good";
    if (entityName) {
      return `${action} - ${entityName}`;
    }
    return `${action} - ${itemTypeLabel}`;
  };

  const getDescription = () => {
    const normalizedType = typeof type === "string" ? type.toUpperCase() : type;
    const action = normalizedType === "IN" ? "incoming" : "outgoing";
    const itemTypeLabel =
      actualItemType === "raw-material" ? "raw material" : "finished good";
    return `Record ${action} stock for ${itemTypeLabel}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="truncate">{getTitle()}</DialogTitle>
          <DialogDescription className="truncate">{getDescription()}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-hidden">
            {!entityId && (
              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => {
                  const normalizedType =
                    typeof type === "string" ? type.toUpperCase() : type;
                  const isOutMovement = normalizedType === "OUT";
                  const itemsWithStock = isOutMovement
                    ? items.filter((i) => (i.currentStock ?? 0) > 0)
                    : items;
                  const itemsWithoutStock = isOutMovement
                    ? items.filter((i) => (i.currentStock ?? 0) === 0)
                    : [];
                  const selectedItem = items.find(
                    (item) => item.id === field.value
                  );

                  return (
                    <FormItem className="flex flex-col min-w-0">
                      <FormLabel>
                        {actualItemType === "raw-material"
                          ? "Raw Material"
                          : "Finished Good"}
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between overflow-hidden min-w-0",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <span className="truncate block min-w-0 text-left">
                                {field.value
                                  ? actualItemType === "raw-material"
                                    ? `${selectedItem?.kode} - ${selectedItem?.name}`
                                    : selectedItem?.name
                                  : `Select ${
                                      actualItemType === "raw-material"
                                        ? "raw material"
                                        : "finished good"
                                    }`}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder={`Cari ${
                                actualItemType === "raw-material"
                                  ? "bahan baku"
                                  : "produk jadi"
                              }...`}
                            />
                            <CommandList className="max-h-[300px]">
                              <CommandEmpty>
                                Tidak ada item yang ditemukan.
                              </CommandEmpty>
                              {itemsWithStock.length > 0 && (
                                <CommandGroup
                                  heading={
                                    isOutMovement ? "Tersedia" : undefined
                                  }
                                >
                                  {itemsWithStock.map((item) => (
                                    <CommandItem
                                      key={item.id}
                                      value={
                                        actualItemType === "raw-material"
                                          ? `${item.kode} ${item.name}`
                                          : item.name
                                      }
                                      onSelect={() => {
                                        form.setValue("itemId", item.id);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0",
                                          item.id === field.value
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                                        <span className="truncate block">
                                          {actualItemType === "raw-material"
                                            ? `${item.kode} - ${item.name}`
                                            : item.name}
                                        </span>
                                        {isOutMovement && (
                                          <span className="text-xs text-green-600 font-medium whitespace-nowrap shrink-0">
                                            (
                                            {(
                                              item.currentStock ?? 0
                                            ).toLocaleString()}
                                            )
                                          </span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                              {itemsWithoutStock.length > 0 && (
                                <CommandGroup heading="Stok Habis">
                                  {itemsWithoutStock.map((item) => (
                                    <CommandItem
                                      key={item.id}
                                      value={
                                        actualItemType === "raw-material"
                                          ? `${item.kode} ${item.name}`
                                          : item.name
                                      }
                                      disabled
                                    >
                                      <Check className="mr-2 h-4 w-4 shrink-0 opacity-0" />
                                      <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden opacity-50">
                                        <span className="truncate block">
                                          {actualItemType === "raw-material"
                                            ? `${item.kode} - ${item.name}`
                                            : item.name}
                                        </span>
                                        <span className="text-xs text-destructive whitespace-nowrap shrink-0">
                                          (Habis)
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => {
                const selectedItemId = form.watch("itemId");
                const selectedItem = items.find(
                  (item) => item.id === selectedItemId
                );
                const availableStock = selectedItem?.currentStock || 0;
                const normalizedType =
                  typeof type === "string" ? type.toUpperCase() : type;

                return (
                  <FormItem className="min-w-0">
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Enter quantity"
                        {...field}
                      />
                    </FormControl>
                    {normalizedType === "OUT" && selectedItem && (
                      <p className="text-xs text-muted-foreground">
                        Available: {availableStock.toLocaleString()}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col min-w-0">
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
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter description" {...field} />
                  </FormControl>
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
                {isLoading ? "Recording..." : "Record"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
