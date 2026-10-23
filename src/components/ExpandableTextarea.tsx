import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Field, Textarea } from "./Form";
import type { TextareaProps } from "./Form";
import { Modal } from "./Modal";

export interface ExpandableTextareaProps extends Omit<
  TextareaProps,
  "ref" | "defaultValue"
> {
  /** Accessible name for the expanded editor and its launcher. */
  label: string;
  /** Both editors share this controlled value; closing never reverts edits. */
  value: string;
  /** Help and validation repeated inside the expanded editor. */
  expandedHint?: ReactNode;
  error?: ReactNode;
  /** Explains how the surrounding form saves the shared value. */
  footerNote?: ReactNode;
}

/** A vertically resizable textarea with a larger, focus-trapped editing view. */
export function ExpandableTextarea({
  label,
  expandedHint,
  error,
  footerNote,
  ...props
}: ExpandableTextareaProps) {
  const [expanded, setExpanded] = useState(false);
  const editor = useRef<HTMLTextAreaElement | null>(null);
  const close = () => setExpanded(false);
  return (
    <>
      <div className="wb-expandable-textarea" inert={expanded}>
        <Textarea {...props} />
        <div className="wb-expandable-textarea-actions">
          <Button
            size="sm"
            aria-label={`Expand ${label}`}
            aria-haspopup="dialog"
            disabled={props.disabled}
            onClick={() => setExpanded(true)}
          >
            Expand
          </Button>
        </div>
      </div>
      <Modal
        open={expanded}
        onClose={close}
        title={label}
        className="wb-textarea-editor"
        initialFocusRef={editor}
        footerNote={footerNote}
        footer={<Button onClick={close}>Done</Button>}
      >
        <Field label={label} hint={expandedHint} error={error}>
          <Textarea
            {...props}
            ref={editor}
            id={undefined}
            name={undefined}
            form={undefined}
            autoFocus={false}
            aria-label={undefined}
            aria-labelledby={undefined}
            aria-describedby={undefined}
            aria-invalid={error ? true : props["aria-invalid"]}
          />
        </Field>
      </Modal>
    </>
  );
}
