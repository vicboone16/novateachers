import { useState } from 'react';
import { invokeCloudFunction } from '@/lib/cloud-functions';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Loader2, Sparkles } from 'lucide-react';

interface Props {
  documentContent: string;
  documentType: 'fba' | 'bip';
  studentName?: string;
}

const AIReviewPanel = ({ documentContent, documentType, studentName }: Props) => {
  const { session } = useAuth();
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const handleReview = async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeCloudFunction('review-fba-bip', {
        document_content: documentContent,
        document_type: documentType,
        student_name: studentName,
      }, session?.access_token);

      if (error) throw error;
      setReview(data.review);
      setHasReviewed(true);
    } catch {
      setReview('Unable to generate AI review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!hasReviewed) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={handleReview}
        disabled={loading}
        className="gap-1.5 text-xs"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
        {loading ? 'Analyzing…' : 'AI Review'}
      </Button>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5 mt-3">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-xs font-heading flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI Clinical Review
          <Badge variant="outline" className="text-[9px] ml-auto bg-primary/10 border-primary/20 text-primary">
            {documentType.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="prose prose-sm dark:prose-invert max-w-none text-xs whitespace-pre-wrap leading-relaxed">
          {review}
        </div>
      </CardContent>
    </Card>
  );
};

export default AIReviewPanel;
