// VTT parser that deduplicates overlapping segments and outputs as single line
export function parseVttToTranscript(vtt: string): string {
  const lines = vtt.replace(/\r/g, '').split('\n');
  let fullTranscript = '';
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    i++;
    if (!line) continue;
    
    // Timestamp line like: 00:00:01.000 --> 00:00:04.000
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/.test(line)) {
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }
      
      // Clean the segment text (remove HTML tags, normalize spaces)
      const segmentText = textLines.join(' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (segmentText) {
        if (!fullTranscript) {
          // First segment - just add it
          fullTranscript = segmentText;
        } else {
          // Find where this segment overlaps with existing transcript
          // YouTube captions typically repeat the last few words
          const overlap = findOverlap(fullTranscript, segmentText);
          
          if (overlap > 0) {
            // Add only the new portion after the overlap
            const newContent = segmentText.substring(overlap).trim();
            if (newContent) {
              fullTranscript += ' ' + newContent;
            }
          } else {
            // No overlap found - this might be a new sentence/section
            fullTranscript += ' ' + segmentText;
          }
        }
      }
    }
  }
  
  // Return as single line with normalized spaces
  return fullTranscript.replace(/\s+/g, ' ').trim();
}

// Helper function to find where new segment overlaps with existing text
function findOverlap(existing: string, newSegment: string): number {
  // Look for overlap in the last portion of existing text
  // Start with longer overlaps and work down to shorter ones
  const maxOverlapLength = Math.min(existing.length, newSegment.length);
  const existingLower = existing.toLowerCase();
  const newSegmentLower = newSegment.toLowerCase();
  
  // Check progressively smaller portions of the end of existing text
  for (let overlapSize = Math.min(100, maxOverlapLength); overlapSize >= 10; overlapSize--) {
    const existingTail = existingLower.slice(-overlapSize);
    const newSegmentHead = newSegmentLower.slice(0, overlapSize);
    
    if (existingTail === newSegmentHead) {
      return overlapSize;
    }
  }
  
  // Try to find partial word overlap (common in captions)
  const lastWords = existing.split(' ').slice(-5).join(' ').toLowerCase();
  const firstWords = newSegment.split(' ').slice(0, 5).join(' ').toLowerCase();
  
  // Check if the beginning of new segment appears at the end of existing
  for (let wordCount = 4; wordCount >= 1; wordCount--) {
    const lastNWords = existing.split(' ').slice(-wordCount).join(' ').toLowerCase();
    const firstNWords = newSegment.split(' ').slice(0, wordCount).join(' ').toLowerCase();
    
    if (lastNWords === firstNWords) {
      // Return the character position where overlap starts
      const overlapIndex = existing.toLowerCase().lastIndexOf(lastNWords);
      return overlapIndex >= 0 ? existing.length - overlapIndex : 0;
    }
  }
  
  return 0; // No overlap found
}
