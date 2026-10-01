package com.group6.auction.product.service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.FileSystemResource;
import javax.imageio.ImageIO;
import java.nio.file.*;
import java.io.*;
import java.util.UUID;

@Service @Profile("!probe")
public class ProductImageStorage {
 private final Path root;
 public ProductImageStorage(@Value("${app.products.image-dir:.runtime/product-images}") String directory){root=Path.of(directory).toAbsolutePath().normalize();}
 public record Staged(Path path,String filename){}
 public Staged stage(MultipartFile file){
  if(file==null)return null;
  if(file.isEmpty())throw new ProductException(400,"EMPTY_IMAGE");
  if(file.getSize()>5L*1024*1024)throw new ProductException(413,"IMAGE_TOO_LARGE");
  Path temp=null;
  try{
   Files.createDirectories(root);
   if(Files.isSymbolicLink(root))throw new IOException("Invalid storage root");
   try(var input=ImageIO.createImageInputStream(new ByteArrayInputStream(file.getBytes()))){
    var readers=ImageIO.getImageReaders(input);
    if(!readers.hasNext())throw new ProductException(415,"INVALID_IMAGE");
    var reader=readers.next();
    try{
     String format=reader.getFormatName().toLowerCase(java.util.Locale.ROOT);
     if(!format.equals("jpeg")&&!format.equals("png"))throw new ProductException(415,"INVALID_IMAGE");
     reader.setInput(input,true,true);
     int width=reader.getWidth(0),height=reader.getHeight(0);
     if(width<1||height<1||(long)width*height>16_000_000)throw new ProductException(413,"IMAGE_TOO_LARGE");
     var image=reader.read(0);
     temp=Files.createTempFile(root,"staging-",".tmp");
     if(!ImageIO.write(image,format,temp.toFile()))throw new IOException("Image encoding unavailable");
     return new Staged(temp,UUID.randomUUID()+ (format.equals("jpeg")?".jpg":".png"));
    }finally{reader.dispose();}
   }
  }catch(ProductException ex){discard(temp);throw ex;}
   catch(IOException|RuntimeException ex){discard(temp);throw new ProductException(415,"IMAGE_PROCESSING_FAILED");}
 }
 public String publish(Staged staged){
  try{Files.move(staged.path(),root.resolve(staged.filename()),StandardCopyOption.ATOMIC_MOVE);return "/api/product-images/"+staged.filename();}
  catch(IOException ex){throw new ProductException(500,"IMAGE_STORAGE_FAILED");}
 }
 public void discard(Staged staged){if(staged!=null)discard(staged.path());}
 public void rollbackPublished(Staged staged){if(staged!=null)discard(root.resolve(staged.filename()));}
 private void discard(Path file){if(file!=null)try{Files.deleteIfExists(file);}catch(IOException ignored){/* A failed cleanup leaves an orphan, never a broken DB reference. */}}
 public Resource read(String name){
  if(!name.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png)"))throw new ProductException(404,"IMAGE_NOT_FOUND");
  Path file=root.resolve(name).normalize();
  try{
   if(!Files.isRegularFile(file,LinkOption.NOFOLLOW_LINKS)||!file.toRealPath().getParent().equals(root.toRealPath()))throw new IOException();
   return new FileSystemResource(file);
  }catch(IOException ex){throw new ProductException(404,"IMAGE_NOT_FOUND");}
 }
}
