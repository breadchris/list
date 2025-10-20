package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
)

func main() {
	scanner := bufio.NewScanner(os.Stdin)

	for scanner.Scan() {
		line := scanner.Bytes()

		var req Request
		if err := json.Unmarshal(line, &req); err != nil {
			writeError(fmt.Sprintf("invalid JSON request: %v", err))
			continue
		}

		handleRequest(req)
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "Error reading stdin: %v\n", err)
		os.Exit(1)
	}
}

func handleRequest(req Request) {
	switch req.Method {
	case "youtube.playlist":
		handlePlaylistRequest(req.Params)
	case "youtube.subtitles":
		handleSubtitlesRequest(req.Params)
	default:
		writeError(fmt.Sprintf("unknown method: %s", req.Method))
	}
}

func handlePlaylistRequest(params json.RawMessage) {
	result, err := handlePlaylist(params)
	if err != nil {
		writeError(err.Error())
		return
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		writeError(fmt.Sprintf("failed to marshal result: %v", err))
		return
	}

	writeSuccess(resultJSON)
}

func handleSubtitlesRequest(params json.RawMessage) {
	result, err := handleSubtitles(params)
	if err != nil {
		writeError(err.Error())
		return
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		writeError(fmt.Sprintf("failed to marshal result: %v", err))
		return
	}

	writeSuccess(resultJSON)
}

func writeSuccess(result json.RawMessage) {
	resp := Response{
		Success: true,
		Result:  result,
	}
	writeResponse(resp)
}

func writeError(message string) {
	resp := Response{
		Success: false,
		Error:   message,
	}
	writeResponse(resp)
}

func writeResponse(resp Response) {
	data, err := json.Marshal(resp)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to marshal response: %v\n", err)
		return
	}

	fmt.Println(string(data))
}
