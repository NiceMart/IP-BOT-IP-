#!/usr/bin/env python3
"""
JumpCutter Wrapper Script for AIGCPanel
This script wraps the jumpcutter Python library to integrate with AIGCPanel's video processing workflow.
"""

import argparse
import os
import sys
import json
import tempfile
from pathlib import Path

# Add jumpcutter to path if it exists in a subdirectory
script_dir = Path(__file__).parent
jumpcutter_path = script_dir / "jumpcutter"
if jumpcutter_path.exists():
    sys.path.insert(0, str(jumpcutter_path))

# Try to import jumpcutter
try:
    from jumpcutter.clip import Clip
except ImportError as e:
    print(f"Error importing jumpcutter: {e}", file=sys.stderr)
    print("Please ensure jumpcutter is installed or the jumpcutter directory contains the required files", file=sys.stderr)
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="JumpCutter wrapper for AIGCPanel")
    
    # Required arguments
    parser.add_argument("--input", "-i", required=True, help="Path to input video file")
    parser.add_argument("--output", "-o", required=True, help="Path to output video file")
    
    # JumpCutter specific arguments
    parser.add_argument("--cut", "-c", 
                     choices=["silent", "voiced", "both"], 
                     default="silent",
                     help="Parts to cut: silent, voiced, or both")
    
    parser.add_argument("--magnitude-threshold-ratio", "-m", 
                     type=float, 
                     default=0.02,
                     help="Audio signal magnitude threshold ratio")
                     
    parser.add_argument("--duration-threshold", "-d", 
                     type=float, 
                     default=0.5,
                     help="Minimum duration of silence in seconds")
                     
    parser.add_argument("--failure-tolerance-ratio", "-f", 
                     type=float, 
                     default=0.1,
                     help="Failure tolerance ratio")
                     
    parser.add_argument("--space-on-edges", "-s", 
                     type=float, 
                     default=0.1,
                     help="Space to leave on edges in seconds")
                     
    parser.add_argument("--silence-part-speed", "-x", 
                     type=int, 
                     help="Speed up silent parts instead of cutting")
                     
    parser.add_argument("--min-loud-part-duration", "-l", 
                     type=int, 
                     default=-1,
                     help="Minimum duration of loud parts in seconds")
                     
    parser.add_argument("--codec", 
                     type=str, 
                     help="Video codec")
                     
    parser.add_argument("--bitrate", 
                     type=str, 
                     help="Video bitrate")
    
    args = parser.parse_args()
    
    try:
        # Validate input file exists
        if not os.path.exists(args.input):
            print(f"Error: Input file does not exist: {args.input}", file=sys.stderr)
            return 1
        
        # Ensure output directory exists
        output_dir = os.path.dirname(os.path.abspath(args.output))
        os.makedirs(output_dir, exist_ok=True)
        
        # Create Clip object and process
        clip = Clip(
            args.input,
            min_loud_part_duration=args.min_loud_part_duration,
            silence_part_speed=args.silence_part_speed
        )
        
        cuts = [args.cut] if args.cut != "both" else ["silent", "voiced"]
        
        print(f"Processing video: {args.input}")
        print(f"Output: {args.output}")
        print(f"Cut mode: {args.cut}")
        print(f"Magnitude threshold ratio: {args.magnitude_threshold_ratio}")
        print(f"Duration threshold: {args.duration_threshold}s")
        print(f"Failure tolerance ratio: {args.failure_tolerance_ratio}")
        print(f"Space on edges: {args.space_on_edges}s")
        
        if args.silence_part_speed:
            print(f"Silence part speed: {args.silence_part_speed}x")
            
        if args.min_loud_part_duration > -1:
            print(f"Min loud part duration: {args.min_loud_part_duration}s")
        
        # Process the video
        outputs = clip.jumpcut(
            cuts,
            args.magnitude_threshold_ratio,
            args.duration_threshold,
            args.failure_tolerance_ratio,
            args.space_on_edges
        )
        
        # Save the results
        for cut_type, jumpcutted_clip in outputs.items():
            if len(outputs) == 2:
                output_path = f"{os.path.splitext(args.output)[0]}_{cut_type}_parts_cut{os.path.splitext(args.output)[1]}"
            else:
                output_path = args.output
                
            kwargs = {}
            if args.codec:
                kwargs['codec'] = args.codec
            if args.bitrate:
                kwargs['bitrate'] = args.bitrate
                
            print(f"Saving processed video: {output_path}")
            jumpcutted_clip.write_videofile(output_path, **kwargs)
        
        # Create output stats file
        stats_file = f"{os.path.splitext(args.output)[0]}_stats.json"
        stats = {
            "input": args.input,
            "output": args.output,
            "cut_mode": args.cut,
            "params": {
                "magnitude_threshold_ratio": args.magnitude_threshold_ratio,
                "duration_threshold": args.duration_threshold,
                "failure_tolerance_ratio": args.failure_tolerance_ratio,
                "space_on_edges": args.space_on_edges,
                "silence_part_speed": args.silence_part_speed,
                "min_loud_part_duration": args.min_loud_part_duration,
                "codec": args.codec,
                "bitrate": args.bitrate
            }
        }
        
        with open(stats_file, 'w') as f:
            json.dump(stats, f, indent=2)
            
        print(f"Processing complete: {args.output}")
        return 0
        
    except Exception as e:
        print(f"Error processing video: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())