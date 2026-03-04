import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Paperclip, Download, X, FileText, Loader2 } from 'lucide-react';

interface Attachment {
  id: string;
  message_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
}

// Upload component for composing messages
export const AttachmentUploader = ({
  files,
  onFilesChange,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    onFilesChange([...files, ...arr]);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.csv"
        onChange={e => addFiles(e.target.files)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        className="gap-1.5 text-xs"
      >
        <Paperclip className="h-3.5 w-3.5" />
        Attach files
      </Button>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <Badge key={i} variant="secondary" className="gap-1 text-xs pr-1">
              <FileText className="h-3 w-3" />
              {f.name}
              <button onClick={() => removeFile(i)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

// Upload files to storage and create attachment records
export const uploadAttachments = async (
  messageId: string,
  senderId: string,
  files: File[],
): Promise<boolean> => {
  for (const file of files) {
    const filePath = `${senderId}/${messageId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('message-attachments')
      .upload(filePath, file);
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return false;
    }

    const { data: urlData } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(filePath);

    await supabase.from('teacher_message_attachments').insert({
      message_id: messageId,
      file_name: file.name,
      file_url: filePath,
      file_type: file.type || null,
      file_size_bytes: file.size,
    });
  }
  return true;
};

// Display attachments on a message
export const AttachmentList = ({ messageId }: { messageId: string }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    if (loaded) return;
    const { data } = await supabase
      .from('teacher_message_attachments')
      .select('*')
      .eq('message_id', messageId);
    setAttachments((data as Attachment[]) || []);
    setLoaded(true);
  };

  // Load on mount
  if (!loaded) load();

  if (attachments.length === 0) return null;

  const handleDownload = async (att: Attachment) => {
    setDownloading(att.id);
    try {
      const { data, error } = await supabase.storage
        .from('message-attachments')
        .download(att.file_url);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {attachments.map(att => (
        <Button
          key={att.id}
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-7"
          disabled={downloading === att.id}
          onClick={() => handleDownload(att)}
        >
          {downloading === att.id ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          {att.file_name}
          {att.file_size_bytes && (
            <span className="text-muted-foreground">({formatSize(att.file_size_bytes)})</span>
          )}
        </Button>
      ))}
    </div>
  );
};
