import { ComfyUIClient } from "./client";

export interface NodeInfo {
  class_type: string;
  inputs: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

export interface PromptNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs: Record<string, any>;
  class_type: string;
  _meta: any;
};

export interface Prompt {
  [nodeId: string]: PromptNode;
}

export interface ComfyUIError {
  type: string;
  message: string;
  details: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra_info: any;
}

export interface QueuePromptResult {
  prompt_id: string;
  number: number;
  node_errors: Record<string, ComfyUIError>;
}

export interface UploadImageResult {
  name: string;
  subfolder: string;
  type: string;
}

export interface ImageRef {
  filename: string;
  subfolder?: string;
  type?: string;
}

export interface EditHistoryRequest {
  clear?: boolean;
  delete?: string[];
}

export interface PromptHistory {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prompt: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outputs: Record<string, any>;
}

export interface HistoryResult {
  [clientId: string]: PromptHistory;
}

export interface OutputImage {
  filename: string;
  subfolder: string;
  type: string;
}

export interface ImageContainer {
  blob: Blob;
  image: OutputImage;
}

export interface ImagesResponse {
  [nodeId: string]: ImageContainer[];
}

export interface DeviceStats {
  name: string;
  type: string;
  index: number;
  vram_total: number;
  vram_free: number;
  torch_vram_total: number;
  torch_vram_free: number;
}

export interface SystemStatsResponse {
  devices: DeviceStats[];
}

export interface ViewMetadataResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export type QueueDataPrimitives = number | string | object;
export type QueueData = QueueDataPrimitives | Array<QueueDataPrimitives>;

export interface QueueResponse {
  queue_running: QueueData[];
  queue_pending: QueueData[];
}

export interface ExecInfo {
  queue_remaining: number;
}

export interface PromptQueueResponse {
  exec_info: ExecInfo;
}

export interface ObjectInfo {
  input: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  output: string[];
  output_is_list: boolean[];
  output_name: string[];
  name: string;
  display_name: string;
  description: string;
  category: string;
  output_node: boolean;
}

export interface ObjectInfoResponse {
  [nodeClass: string]: ObjectInfo;
}

export interface ResponseError {
  error: string | ComfyUIError;
  node_errors: Record<string, ComfyUIError>;
}

// Taken from https://github.com/comfyanonymous/ComfyUI/blob/master/folder_paths.py
export type FolderName =
  | 'checkpoints'
  | 'configs'
  | 'loras'
  | 'vae'
  | 'clip'
  | 'unet'
  | 'clip_vision'
  | 'style_models'
  | 'embeddings'
  | 'diffusers'
  | 'vae_approx'
  | 'controlnet'
  | 'gligen'
  | 'upscale_models'
  | 'custom_nodes'
  | 'hypernetworks';

  export class ComfyWorkflow {
    RawPrompt: Prompt;
    InputNodePrefix: string;
    OutputNodePrefix: string;
  
    InputNodes : Record<string, PromptNode>;
    OutputNodeIdsByName : Record<string, string>;
  
    constructor(prompt: Prompt, inputNodePrefix: string = "INPUT_", outputNodePrefix: string = "OUTPUT_") {
      this.RawPrompt = prompt;
      this.InputNodePrefix = inputNodePrefix;
      this.OutputNodePrefix = outputNodePrefix;
  
      this.InputNodes = {};
      this.OutputNodeIdsByName = {};
  
      // Cache all "input" and "output" nodes.
      for (const nodeId in this.RawPrompt) {
        const node = this.RawPrompt[nodeId];
        if (node._meta) {
          if(ComfyWorkflow.nodeMatchesQuery(node._meta.title, inputNodePrefix, false, false)) {
            this.InputNodes[node._meta.title.replace(inputNodePrefix, "")] = node;
          } else if(ComfyWorkflow.nodeMatchesQuery(node._meta.title, outputNodePrefix, false, false)) {
            this.OutputNodeIdsByName[node._meta.title.replace(outputNodePrefix, "")] = nodeId;
          }
        }
      }
    }
  
    public async getImages(client: ComfyUIClient) : Promise<Record<string, ImageContainer[]>> {
      const finalCollection: Record<string, ImageContainer[]> = {};
      const images = await client.getImages(this.RawPrompt);

      for(const outputName in this.OutputNodeIdsByName) {
        const result = this.getImagesFromOutput(outputName, images);
        if(result) {
          finalCollection[outputName] = result;
        }
      }

      return finalCollection;
    }

    public getImagesFromOutput(nodeName: string, response: ImagesResponse): ImageContainer[] | undefined {
      return response[this.OutputNodeIdsByName[nodeName]];
    }

    public getNodeByName(nodeName: string, matchExact: boolean = true, matchCase: boolean = false): PromptNode | undefined {
      const nodeId = this.getNodeIdByName(nodeName, matchExact, matchCase);
      if(nodeId) {
        return this.RawPrompt[nodeId];
      }
      return undefined;
    }
  
    public getNodeIdByName(nodeName: string, matchExact: boolean = true, matchCase: boolean = false): string | undefined {
      const result = this.getNodeIdsByNodeName(nodeName, matchExact, matchCase);
      if (result) {
        if (result.length === 0) {
          return undefined;
        }
        if (result.length > 1) {
          console.log(`[ComfyUI Workflow Wrapper] More than one node matches name ${nodeName}. Returning first occurrence`);
        }
        return result[0]
      }
    }
  
    public getNodeIdsByNodeName(nodeName: string, matchExact: boolean = true, matchCase: boolean = false): string[] | undefined {
      const matchingNodes: string[] = [];
  
      for (const nodeId in this.RawPrompt) {
        const node = this.RawPrompt[nodeId];
        if (node._meta) {
          if (ComfyWorkflow.nodeMatchesQuery(node?._meta.title, nodeName, matchExact, matchCase)) {
            matchingNodes.push(nodeId);
          }
        }
      }
  
      return matchingNodes;
    }
  
    private static nodeMatchesQuery(metadataTitle:string, desiredName: string, matchExact: boolean, matchCase: boolean) {
      if(!metadataTitle) {
        return false;
      }
  
      var nameA = metadataTitle;
      var nameB = desiredName;
  
      if(!matchCase) {
        nameA = nameA.toLowerCase();
        nameB = nameB.toLowerCase();
      }
  
      return (matchExact ? nameA === nameB : nameA.includes(nameB));
    }
  }