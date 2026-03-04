import filesize from 'filesize'
import { formatDistanceToNow, addMinutes, isPast } from 'date-fns'

import type { CustomFile } from './types'

import { generateUniqueId } from '@/utilities/generators'
import { getFileExtension } from '@/utilities/strings'


export function isImageFile(fileExtension: string) {
  const images = ['png','pdf','eps','raw','cr2', 'nef', 'orf', 'sr2','gif', 'jpg', 'jpeg', 'bmp', 'tif', 'tiff']
  if (images.includes(fileExtension)){
    return true
  }else{
    return false
  }
}

export function isVideoFile(fileExtension: string) {
  const videos = ['mov','mp4', 'wmv', 'flv','mp3']
  if (videos.includes(fileExtension)){
    return true
  }else{
    return false
  }
}

export function isCollectionFile(fileExtension: string) {
  console.log('do nothing')
}


export function isFileExpired(fileCreationDate: string) {
  const creationDate = new Date(fileCreationDate)
  const expireDate = addMinutes(creationDate, 30)

  return isPast(expireDate)
}

export function getTimeToExpireFile(fileCreationDate: string) {
  const creationDate = new Date(fileCreationDate)
  const expireDate = addMinutes(creationDate, 30)
  const timeToExpire = formatDistanceToNow(expireDate)

  return timeToExpire
}

export function getCurrentISODate() {
  return new Date().toISOString()
}

export function parseFile(file: File): CustomFile {
  return {
    rawFile: file,
    id: generateUniqueId(),
    name: file.name,
    extension: getFileExtension(file.name),
    size: file.size,
    progress: 0,
    url: null,
    createdAt: getCurrentISODate(),
    isSettled: false,
    isUploaded: false,
    isUploadFailed: false,
    isUploadCanceled: false,
    isBiggerThanSizeLimit: false,
  }
}

export function getReadableSize(size: number) {
  const sizeFormatter = filesize.partial({ round: 0 })
  return sizeFormatter(size)
}

export function getCopyLink(url: string) {
  //https://theprivatecollection.s3.us-east-2.amazonaws.com/uploads/test.png
  const incoming_string = url
  const regex = /uploads(.*)/;
  const match = regex.exec(incoming_string);
  if (match) {
    const url = match[0]
    // return `localhost:8080/media/${url}`
    return `theprivatecollection.co/media/${url}`
  
  } else{
    console.log('Something went wrong with your copy, please report')
  }

      
}

export function getUploadCopyLink(url: string) {
  //https://theprivatecollection.s3.us-east-2.amazonaws.com/uploads/test.png
  const incoming_string = url
  const regex = /uploads(.*)/;
  const match = regex.exec(incoming_string);
  if (match) {
    const url = match[0]
    return `theprivatecollection.co/media/${url}`
  } else{
    console.log('Something went wrong with your copy, please report')
  }
      
}




export function getMediaLink(url: string) {
  const incoming_string = url
  const regex = /\.([a-zA-Z0-9_.-]{3,4})$/;
  const match = regex.exec(incoming_string);
  if (match) {
    const url = match[0].replace('.','')
    const lower_case = url.toLowerCase();
    return lower_case
  } else{
    console.log('Something went wrong with your copy, please report')
  }
      
 
      
}


