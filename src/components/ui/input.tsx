import * as React from "react";
import { cn } from "./utils";
import { X } from "lucide-react";

export interface InputProps extends React.ComponentProps<"input"> {
  onClear?: () => void;
  clearable?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", value, onChange, onClear, clearable = true, disabled, readOnly, style, ...props }, ref) => {
    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    const isClearableType = type === "text" || type === "search" || type === "number" || type === "url" || type === "password" || type === "email";
    const showClear = Boolean(clearable && isClearableType && hasValue && !disabled && !readOnly);

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
      <div className="relative flex items-center w-full min-w-0">
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
            showClear && "pr-8",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            className,
          )}
          style={style}
          {...props}
        />
        {showClear && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none z-10 cursor-pointer"
            title="Limpar campo"
            tabIndex={-1}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
