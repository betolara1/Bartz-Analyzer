import * as React from "react";
import { cn } from "./utils";
import { X, Search } from "lucide-react";

/**
 * Ícone único e padronizado de busca para todos os campos de pesquisa do sistema.
 * Centralizado e uniforme em tamanho e estilo.
 */
export const searchIcon = (
  <Search className="h-3.5 w-3.5 text-muted-foreground transition-colors" />
);

export const SearchIcon = ({ className }: { className?: string }) => (
  <Search className={cn("h-3.5 w-3.5 text-muted-foreground transition-colors", className)} />
);

export interface InputProps extends React.ComponentProps<"input"> {
  onClear?: () => void;
  clearable?: boolean;
  leftIcon?: React.ReactNode;
  onLeftIconClick?: () => void;
  search?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", value, onChange, onClear, clearable = true, disabled, readOnly, style, leftIcon, onLeftIconClick, search, ...props }, ref) => {
    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    const isClearableType = type === "text" || type === "search" || type === "number" || type === "url" || type === "password" || type === "email";
    const showClear = Boolean(clearable && isClearableType && hasValue && !disabled && !readOnly);
    const effectiveLeftIcon = leftIcon !== undefined ? leftIcon : (search || type === "search" ? searchIcon : null);

    const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (onClear) {
        onClear();
      }
      if (onChange) {
        const event = {
          target: { value: "" },
          currentTarget: { value: "" },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(event);
      }
    };

    return (
      <div className="relative flex items-center w-full min-w-0 group">
        {effectiveLeftIcon && (
          <div
            onClick={onLeftIconClick}
            className={cn(
              "absolute left-3 inset-y-0 flex items-center justify-center text-muted-foreground group-focus-within:text-primary transition-colors z-10",
              onLeftIconClick ? "cursor-pointer pointer-events-auto hover:text-foreground" : "pointer-events-none"
            )}
            style={{ top: 0, bottom: 0 }}
          >
            {effectiveLeftIcon}
          </div>
        )}
        <input
          type={type}
          ref={ref}
          value={value}
          onChange={onChange}
          disabled={disabled}
          readOnly={readOnly}
          data-slot="input"
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            effectiveLeftIcon && "!pl-10",
            showClear && "pr-8",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            className,
          )}
          style={{
            ...(effectiveLeftIcon ? { paddingLeft: "2.5rem" } : {}),
            ...style
          }}
          {...props}
        />
        {showClear && (
          <div
            className="absolute right-2 inset-y-0 flex items-center justify-center z-10"
            style={{ top: 0, bottom: 0 }}
          >
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none cursor-pointer"
              title="Limpar campo"
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
